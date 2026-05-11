const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "data", "cqb.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS jugadores (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE,
    contrasena TEXT NOT NULL,
    victorias INTEGER NOT NULL DEFAULT 0,
    derrotas INTEGER NOT NULL DEFAULT 0,
    partidas_jugadas INTEGER NOT NULL DEFAULT 0,
    reservas_activas INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    jugador_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (jugador_id) REFERENCES jugadores (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS eventos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    nivel TEXT NOT NULL,
    precio TEXT NOT NULL,
    cupos INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reservas (
    id TEXT PRIMARY KEY,
    jugador_id TEXT NOT NULL,
    evento_id TEXT NOT NULL,
    evento_titulo TEXT NOT NULL,
    evento_fecha TEXT NOT NULL,
    estado TEXT NOT NULL,
    resultado TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (jugador_id) REFERENCES jugadores (id) ON DELETE CASCADE,
    FOREIGN KEY (evento_id) REFERENCES eventos (id) ON DELETE CASCADE
  );
`);

const seedEvents = [
  {
    id: "evt-1",
    titulo: "Operacion Tactica Nocturna",
    fecha: "2026-05-22T20:00:00",
    nivel: "Intermedio",
    precio: "$14",
    cupos: 40,
  },
  {
    id: "evt-2",
    titulo: "CQB Sabado | Turno Manana",
    fecha: "2026-05-23T10:30:00",
    nivel: "Principiante",
    precio: "$10",
    cupos: 40,
  },
  {
    id: "evt-3",
    titulo: "CQB Sabado | Turno Tarde",
    fecha: "2026-05-23T17:00:00",
    nivel: "Intermedio",
    precio: "$12",
    cupos: 40,
  },
  {
    id: "evt-4",
    titulo: "CQB Domingo | Turno Manana",
    fecha: "2026-05-24T11:00:00",
    nivel: "Principiante",
    precio: "$10",
    cupos: 40,
  },
  {
    id: "evt-5",
    titulo: "Liga Squad Domingo | Turno Tarde",
    fecha: "2026-05-24T16:30:00",
    nivel: "Avanzado",
    precio: "$18",
    cupos: 40,
  },
];

const countEvents = db.prepare("SELECT COUNT(*) AS total FROM eventos").get().total;
if (countEvents === 0) {
  const insertEvent = db.prepare(
    "INSERT INTO eventos (id, titulo, fecha, nivel, precio, cupos) VALUES (@id, @titulo, @fecha, @nivel, @precio, @cupos)"
  );
  const seedTx = db.transaction((rows) => rows.forEach((row) => insertEvent.run(row)));
  seedTx(seedEvents);
}

function getJugadorByCorreo(correo) {
  return db.prepare("SELECT * FROM jugadores WHERE correo = ?").get(correo);
}

function getJugadorById(id) {
  return db.prepare("SELECT * FROM jugadores WHERE id = ?").get(id);
}

function createJugador(jugador) {
  db.prepare(
    `INSERT INTO jugadores
      (id, nombre, correo, contrasena, victorias, derrotas, partidas_jugadas, reservas_activas, created_at)
      VALUES (@id, @nombre, @correo, @contrasena, @victorias, @derrotas, @partidas_jugadas, @reservas_activas, @created_at)`
  ).run(jugador);
}

function upsertSesion(token, jugadorId) {
  db.prepare("DELETE FROM sesiones WHERE jugador_id = ?").run(jugadorId);
  db.prepare("INSERT INTO sesiones (token, jugador_id, created_at) VALUES (?, ?, ?)").run(
    token,
    jugadorId,
    new Date().toISOString()
  );
}

function getSesionByToken(token) {
  return db.prepare("SELECT * FROM sesiones WHERE token = ?").get(token);
}

function deleteSesion(token) {
  db.prepare("DELETE FROM sesiones WHERE token = ?").run(token);
}

function getReservasByJugador(jugadorId) {
  return db
    .prepare("SELECT * FROM reservas WHERE jugador_id = ? ORDER BY evento_fecha ASC")
    .all(jugadorId);
}

function getEventosConDisponibilidad() {
  return db
    .prepare(
      `SELECT
        e.id,
        e.titulo,
        e.fecha,
        e.nivel,
        e.precio,
        e.cupos,
        MAX(0, e.cupos - COALESCE(r.reservas_activas, 0)) AS cupos_disponibles
      FROM eventos e
      LEFT JOIN (
        SELECT evento_id, COUNT(*) AS reservas_activas
        FROM reservas
        WHERE estado = 'upcoming'
        GROUP BY evento_id
      ) r ON r.evento_id = e.id
      ORDER BY e.fecha ASC`
    )
    .all();
}

function getEventoById(eventoId) {
  return db.prepare("SELECT * FROM eventos WHERE id = ?").get(eventoId);
}

function hasReservaActiva(jugadorId, eventoId) {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM reservas WHERE jugador_id = ? AND evento_id = ? AND estado = 'upcoming'")
    .get(jugadorId, eventoId);
  return row.total > 0;
}

function countReservasActivasPorEvento(eventoId) {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM reservas WHERE evento_id = ? AND estado = 'upcoming'")
    .get(eventoId);
  return row.total;
}

function createReserva(reserva) {
  const tx = db.transaction((payload) => {
    db.prepare(
      `INSERT INTO reservas
        (id, jugador_id, evento_id, evento_titulo, evento_fecha, estado, resultado, created_at)
        VALUES (@id, @jugador_id, @evento_id, @evento_titulo, @evento_fecha, @estado, @resultado, @created_at)`
    ).run(payload);

    db.prepare("UPDATE jugadores SET reservas_activas = reservas_activas + 1 WHERE id = ?").run(
      payload.jugador_id
    );
  });

  tx(reserva);
}

function getReservaByIdForJugador(reservaId, jugadorId) {
  return db
    .prepare("SELECT * FROM reservas WHERE id = ? AND jugador_id = ?")
    .get(reservaId, jugadorId);
}

function setResultadoReserva(reservaId, jugadorId, resultado) {
  const tx = db.transaction((payload) => {
    db.prepare("UPDATE reservas SET estado = 'played', resultado = ? WHERE id = ? AND jugador_id = ?").run(
      payload.resultado,
      payload.reservaId,
      payload.jugadorId
    );

    db.prepare(
      `UPDATE jugadores
       SET
         partidas_jugadas = partidas_jugadas + 1,
         victorias = victorias + CASE WHEN ? = 'win' THEN 1 ELSE 0 END,
         derrotas = derrotas + CASE WHEN ? = 'loss' THEN 1 ELSE 0 END,
         reservas_activas = CASE WHEN reservas_activas > 0 THEN reservas_activas - 1 ELSE 0 END
       WHERE id = ?`
    ).run(payload.resultado, payload.resultado, payload.jugadorId);
  });

  tx({ reservaId, jugadorId, resultado });
}

module.exports = {
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
};
