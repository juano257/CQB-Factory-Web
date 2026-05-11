const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
  getJugadorByCorreo,
  getJugadorById,
  createJugador,
  upsertSesion,
  getSesionByToken,
  deleteSesion,
  getReservasByJugador,
  getEventosConDisponibilidad,
  getEventoById,
  hasReservaActiva,
  countReservasActivasPorEvento,
  createReserva,
  getReservaByIdForJugador,
  setResultadoReserva,
} = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

function mapReserva(reserva) {
  return {
    id: reserva.id,
    eventId: reserva.evento_id,
    eventTitle: reserva.evento_titulo,
    eventDate: reserva.evento_fecha,
    status: reserva.estado,
    result: reserva.resultado || null,
    createdAt: reserva.created_at,
  };
}

function sanitizeJugador(jugador, reservas = []) {
  return {
    id: jugador.id,
    name: jugador.nombre,
    email: jugador.correo,
    createdAt: jugador.created_at,
    matchesPlayed: jugador.partidas_jugadas,
    wins: jugador.victorias,
    losses: jugador.derrotas,
    activeReservations: jugador.reservas_activas,
    reservations: reservas.map(mapReserva),
  };
}

function getWinRate(jugador) {
  const played = jugador.partidas_jugadas || 0;
  if (!played) return 0;
  return Math.round(((jugador.victorias || 0) / played) * 100);
}

function getBadge(jugador) {
  const played = jugador.partidas_jugadas || 0;
  const winRate = getWinRate(jugador);

  if (played < 5) return "Recluta";
  if (winRate >= 70) return "Comando Elite";
  if (winRate >= 55) return "Operador";
  if (winRate >= 40) return "Fusilero";
  return "Cadete";
}

function buildProfile(jugador) {
  const reservas = getReservasByJugador(jugador.id);
  const profile = sanitizeJugador(jugador, reservas);
  const lossRate = profile.matchesPlayed ? Math.max(0, 100 - getWinRate(jugador)) : 0;
  const ratio =
    profile.wins === 0 && profile.losses === 0
      ? "0.00"
      : profile.losses === 0
        ? profile.wins.toFixed(2)
        : (profile.wins / profile.losses).toFixed(2);

  return {
    ...profile,
    stats: {
      upcoming: profile.activeReservations,
      winRate: getWinRate(jugador),
      lossRate,
      ratio,
      badge: getBadge(jugador),
    },
  };
}

function getBearerToken(headerValue) {
  if (!headerValue) return null;
  const [type, token] = headerValue.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function authMiddleware(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  const sesion = getSesionByToken(token);
  if (!sesion) {
    return res.status(401).json({ message: "Sesion invalida" });
  }

  const jugador = getJugadorById(sesion.jugador_id);
  if (!jugador) {
    return res.status(401).json({ message: "Usuario no encontrado" });
  }

  req.token = token;
  req.jugador = jugador;
  return next();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "cqb-backend", database: "sqlite" });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email y password son obligatorios" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = getJugadorByCorreo(normalizedEmail);
  if (exists) {
    return res.status(409).json({ message: "El correo ya esta registrado" });
  }

  const newJugador = {
    id: uuidv4(),
    nombre: String(name).trim(),
    correo: normalizedEmail,
    contrasena: String(password),
    victorias: 0,
    derrotas: 0,
    partidas_jugadas: 0,
    reservas_activas: 0,
    created_at: new Date().toISOString(),
  };

  createJugador(newJugador);
  const token = uuidv4();
  upsertSesion(token, newJugador.id);

  return res.status(201).json({ token, user: buildProfile(newJugador) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const jugador = getJugadorByCorreo(normalizedEmail);
  if (!jugador || jugador.contrasena !== String(password || "")) {
    return res.status(401).json({ message: "Credenciales invalidas" });
  }

  const token = uuidv4();
  upsertSesion(token, jugador.id);
  return res.json({ token, user: buildProfile(jugador) });
});

app.post("/api/auth/logout", authMiddleware, (req, res) => {
  deleteSesion(req.token);
  return res.json({ message: "Sesion cerrada" });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const freshJugador = getJugadorById(req.jugador.id);
  return res.json({ user: buildProfile(freshJugador) });
});

app.get("/api/events", (req, res) => {
  const events = getEventosConDisponibilidad().map((event) => ({
    id: event.id,
    title: event.titulo,
    date: event.fecha,
    level: event.nivel,
    price: event.precio,
    slots: event.cupos,
    availableSlots: event.cupos_disponibles,
  }));

  return res.json({ events });
});

app.post("/api/events/:eventId/reserve", authMiddleware, (req, res) => {
  const { eventId } = req.params;
  const event = getEventoById(eventId);

  if (!event) {
    return res.status(404).json({ message: "Partida no encontrada" });
  }

  if (hasReservaActiva(req.jugador.id, eventId)) {
    return res.status(409).json({ message: "Ya tienes una reserva para esta partida" });
  }

  const booked = countReservasActivasPorEvento(eventId);
  if (booked >= event.cupos) {
    return res.status(409).json({ message: "No quedan cupos disponibles" });
  }

  const reservation = {
    id: uuidv4(),
    jugador_id: req.jugador.id,
    evento_id: event.id,
    evento_titulo: event.titulo,
    evento_fecha: event.fecha,
    estado: "upcoming",
    resultado: null,
    created_at: new Date().toISOString(),
  };

  createReserva(reservation);

  const freshJugador = getJugadorById(req.jugador.id);
  return res.status(201).json({
    reservation: mapReserva(reservation),
    user: buildProfile(freshJugador),
  });
});

app.post("/api/reservations/:reservationId/result", authMiddleware, (req, res) => {
  const { reservationId } = req.params;
  const { result } = req.body;

  if (result !== "win" && result !== "loss") {
    return res.status(400).json({ message: "result debe ser win o loss" });
  }

  const target = getReservaByIdForJugador(reservationId, req.jugador.id);
  if (!target) {
    return res.status(404).json({ message: "Reserva no encontrada" });
  }

  if (target.estado !== "upcoming") {
    return res.status(409).json({ message: "La reserva ya tiene resultado" });
  }

  setResultadoReserva(reservationId, req.jugador.id, result);
  const freshJugador = getJugadorById(req.jugador.id);

  return res.json({ user: buildProfile(freshJugador) });
});

app.use(express.static(path.join(__dirname, "..")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

module.exports = app;
