const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const {
  getJugadorByCorreo,
  getJugadorById,
  createJugador,
  saveEmailVerificationToken,
  verifyEmailByTokenHash,
  clearExpiredEmailVerificationToken,
  savePasswordResetToken,
  resetPasswordByTokenHash,
  clearExpiredPasswordResetToken,
  upsertSesion,
  getSesionByToken,
  deleteSesion,
  getReservasByJugador,
  getEventosConDisponibilidad,
  getEventosParaModeracion,
  createEvento,
  deleteEventoSiSinReservas,
  getEventoById,
  hasReservaActiva,
  countReservasActivasPorEvento,
  createReserva,
  getReservaById,
  getJugadoresRegistrados,
  getReservasActivasPorEvento,
  setEquipoReservaModeracion,
  getReservasParaModeracion,
  getTemporadaActual,
  countReservasActivasTemporada,
  cerrarTemporadaActiva,
  iniciarNuevaTemporada,
  setResultadoReserva,
  setResultadosEventoPorEquipo,
  getMondayOfWeek,
  validateInscriptionWindow,
  isModeratorEmail,
  ensureModeratorRoleForEmail,
} = require("./db");
const { isMailerConfigured, sendVerificationEmail, sendPasswordResetEmail } = require("./mailer");

function isStaffRole(role) {
  return role === "moderator" || role === "admin";
}

const app = express();

app.set("trust proxy", true);

app.use(cors());
app.use(express.json());

const pendingPayments = new Map();
const PAYMENT_TTL_MS = 15 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;

function getConfiguredAppUrl() {
  const raw = String(process.env.APP_URL || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch (_error) {
    return null;
  }
}

function getCanonicalHost() {
  const explicitHost = String(process.env.CANONICAL_HOST || "").trim().toLowerCase();
  if (explicitHost) return explicitHost;

  const configuredUrl = getConfiguredAppUrl();
  if (!configuredUrl) return null;
  return configuredUrl.host.toLowerCase();
}

function getCanonicalProtocol() {
  const explicitProtocol = String(process.env.CANONICAL_PROTOCOL || "").trim().toLowerCase();
  if (explicitProtocol === "http" || explicitProtocol === "https") {
    return explicitProtocol;
  }

  const configuredUrl = getConfiguredAppUrl();
  if (!configuredUrl) return "https";
  return configuredUrl.protocol.replace(":", "").toLowerCase() || "https";
}

function normalizeRequestHost(hostValue) {
  const firstHost = String(hostValue || "").split(",")[0].trim().toLowerCase();
  if (!firstHost) return "";
  return firstHost;
}

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();

  const canonicalHost = getCanonicalHost();
  if (!canonicalHost) return next();

  const canonicalProtocol = getCanonicalProtocol();
  const requestHost = normalizeRequestHost(req.headers["x-forwarded-host"] || req.get("host"));
  const requestProtocol = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim()
    .toLowerCase();

  const matchesCanonicalHost = requestHost === canonicalHost;
  const matchesCanonicalProtocol = requestProtocol === canonicalProtocol;

  if (matchesCanonicalHost && matchesCanonicalProtocol) {
    return next();
  }

  return res.redirect(301, `${canonicalProtocol}://${canonicalHost}${req.originalUrl}`);
});

function mapReserva(reserva) {
  return {
    id: reserva.id,
    eventId: reserva.evento_id,
    eventTitle: reserva.evento_titulo,
    eventDate: reserva.evento_fecha,
    team: reserva.equipo,
    status: reserva.estado,
    result: reserva.resultado || null,
    createdAt: reserva.created_at,
  };
}

function mapReservaModeracion(reserva) {
  return {
    ...mapReserva(reserva),
    playerId: reserva.jugador_id,
    playerName: reserva.jugador_nombre,
    playerEmail: reserva.jugador_correo,
  };
}

function mapJugadorModeracion(jugador) {
  return {
    id: jugador.id,
    name: jugador.nombre,
    email: jugador.correo,
    role: jugador.rol || "user",
    wins: jugador.victorias || 0,
    losses: jugador.derrotas || 0,
    matchesPlayed: jugador.partidas_jugadas || 0,
    activeReservations: jugador.reservas_activas || 0,
    createdAt: jugador.created_at,
  };
}

function mapEventoModeracion(evento) {
  return {
    id: evento.id,
    title: evento.titulo,
    date: evento.fecha,
    level: evento.nivel,
    price: evento.precio,
    slots: evento.cupos,
    availableSlots: evento.cupos_disponibles,
    enrolledTotal: evento.inscritos_totales,
    enrolledUpcoming: evento.inscritos_pendientes,
    enrolledPlayed: evento.inscritos_cerrados,
  };
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function mapTemporada(temporada) {
  if (!temporada) return null;

  return {
    id: temporada.id,
    number: temporada.numero,
    name: temporada.nombre,
    status: temporada.estado,
    startedAt: temporada.started_at,
    endedAt: temporada.ended_at || null,
  };
}

async function sanitizeJugador(jugador, reservas = []) {
  return {
    id: jugador.id,
    name: jugador.nombre,
    email: jugador.correo,
    emailVerified: Boolean(jugador.email_verificado),
    role: jugador.rol || "user",
    createdAt: jugador.created_at,
    matchesPlayed: jugador.partidas_jugadas,
    wins: jugador.victorias,
    losses: jugador.derrotas,
    activeReservations: jugador.reservas_activas,
    reservations: reservas.map(mapReserva),
  };
}

function getAppBaseUrl(req) {
  const configuredBaseUrl = String(process.env.APP_URL || "").trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
  return `${protocol}://${host}`.replace(/\/$/, "");
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getEmailVerificationStatus(jugador) {
  if (!jugador) return "invalid";
  if (jugador.email_verificado) return "verified";
  if (!jugador.email_verification_expires_at) return "pending";
  return jugador.email_verification_expires_at < new Date().toISOString() ? "expired" : "pending";
}

async function issueEmailVerification(jugador, req) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString();
  const verificationUrl = `${getAppBaseUrl(req)}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  await saveEmailVerificationToken(jugador.id, tokenHash, expiresAt, nowIso);

  if (!isMailerConfigured()) {
    console.warn(`SMTP no configurado. Enlace de verificacion para ${jugador.correo}: ${verificationUrl}`);
    return {
      sent: false,
      verificationUrl,
      reason: "smtp_not_configured",
      expiresAt,
    };
  }

  try {
    await sendVerificationEmail({
      to: jugador.correo,
      name: jugador.nombre,
      verificationUrl,
    });
  } catch (error) {
    console.error(`No fue posible enviar el correo de verificacion a ${jugador.correo}:`, error);
    return {
      sent: false,
      verificationUrl,
      reason: "smtp_send_failed",
      expiresAt,
    };
  }

  return {
    sent: true,
    verificationUrl,
    reason: null,
    expiresAt,
  };
}

async function issuePasswordReset(jugador, req) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
  const resetUrl = `${getAppBaseUrl(req)}/reset-password.html?token=${encodeURIComponent(rawToken)}`;

  await savePasswordResetToken(jugador.id, tokenHash, expiresAt, nowIso);

  if (!isMailerConfigured()) {
    console.warn(`SMTP no configurado. Enlace de reset para ${jugador.correo}: ${resetUrl}`);
    return {
      sent: false,
      resetUrl,
      reason: "smtp_not_configured",
      expiresAt,
    };
  }

  try {
    await sendPasswordResetEmail({
      to: jugador.correo,
      name: jugador.nombre,
      resetUrl,
    });
  } catch (error) {
    console.error(`No fue posible enviar el correo de reset a ${jugador.correo}:`, error);
    return {
      sent: false,
      resetUrl,
      reason: "smtp_send_failed",
      expiresAt,
    };
  }

  return {
    sent: true,
    resetUrl,
    reason: null,
    expiresAt,
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

async function buildProfile(jugador) {
  const reservas = await getReservasByJugador(jugador.id);
  const profile = await sanitizeJugador(jugador, reservas);
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

async function authMiddleware(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    const sesion = await getSesionByToken(token);
    if (!sesion) {
      return res.status(401).json({ message: "Sesion invalida" });
    }

    const jugador = await getJugadorById(sesion.jugador_id);
    if (!jugador) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    req.token = token;
    req.jugador = jugador;
    return next();
  } catch (err) {
    return next(err);
  }
}

function moderatorMiddleware(req, res, next) {
  if (!isStaffRole(req.jugador?.rol)) {
    return res.status(403).json({
      message: "Solo administradores o moderadores pueden usar esta seccion.",
    });
  }

  return next();
}

function cleanupExpiredPayments() {
  const now = Date.now();
  for (const [token, payment] of pendingPayments.entries()) {
    const createdAt = new Date(payment.createdAt).getTime();
    if (now - createdAt > PAYMENT_TTL_MS) {
      pendingPayments.delete(token);
    }
  }
}

async function validateReservationEligibility(jugadorId, eventId, team) {
  const season = await getTemporadaActual();
  const event = await getEventoById(eventId);
  const jugador = await getJugadorById(jugadorId);

  if (!jugador) {
    return { ok: false, status: 404, message: "Usuario no encontrado" };
  }

  if (!jugador.email_verificado) {
    return {
      ok: false,
      status: 403,
      message: "Debes verificar tu correo antes de inscribirte a una partida.",
    };
  }

  if (!season) {
    return {
      ok: false,
      status: 409,
      message: "No hay temporada activa. Espera a que inicie la siguiente temporada.",
    };
  }

  if (!event) {
    return { ok: false, status: 404, message: "Partida no encontrada" };
  }

  if (!["rojo", "azul"].includes(team)) {
    return { ok: false, status: 400, message: "Debes elegir equipo rojo o azul" };
  }

  const inscriptionValidation = validateInscriptionWindow(event.fecha);
  if (!inscriptionValidation.canInscribe) {
    return { ok: false, status: 409, message: inscriptionValidation.error };
  }

  if (await hasReservaActiva(jugadorId, eventId)) {
    return { ok: false, status: 409, message: "Ya tienes una reserva para esta partida" };
  }

  const booked = await countReservasActivasPorEvento(eventId);
  if (booked >= event.cupos) {
    return { ok: false, status: 409, message: "No quedan cupos disponibles" };
  }

  return {
    ok: true,
    event,
    season,
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "cqb-backend", database: "postgresql" });
});

app.post("/api/auth/register", asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email y password son obligatorios" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = await getJugadorByCorreo(normalizedEmail);
  if (exists) {
    return res.status(409).json({ message: "El correo ya esta registrado" });
  }

  const newJugador = {
    id: uuidv4(),
    nombre: String(name).trim(),
    correo: normalizedEmail,
    contrasena: String(password),
    rol: isModeratorEmail(normalizedEmail) ? "moderator" : "user",
    victorias: 0,
    derrotas: 0,
    partidas_jugadas: 0,
    reservas_activas: 0,
    created_at: new Date().toISOString(),
    email_verificado: false,
    email_verification_token_hash: null,
    email_verification_expires_at: null,
    email_verification_sent_at: null,
  };

  await createJugador(newJugador);
  await ensureModeratorRoleForEmail(normalizedEmail);
  const verification = await issueEmailVerification(newJugador, req);
  const createdJugador = await getJugadorById(newJugador.id);
  const token = uuidv4();
  await upsertSesion(token, newJugador.id);

  return res.status(201).json({
    token,
    user: await buildProfile(createdJugador),
    verificationEmailSent: verification.sent,
    verificationRequired: true,
    message: verification.sent
      ? "Cuenta creada. Te enviamos un enlace para verificar tu correo."
      : "Cuenta creada, pero no fue posible enviar el correo automaticamente. Revisa la configuracion SMTP o usa reenviar enlace.",
  });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const jugador = await getJugadorByCorreo(normalizedEmail);
  if (!jugador || jugador.contrasena !== String(password || "")) {
    return res.status(401).json({ message: "Credenciales invalidas" });
  }

  await ensureModeratorRoleForEmail(normalizedEmail);
  const freshJugador = await getJugadorById(jugador.id);

  const token = uuidv4();
  await upsertSesion(token, freshJugador.id);
  return res.json({
    token,
    user: await buildProfile(freshJugador),
    verificationRequired: !freshJugador.email_verificado,
  });
}));

app.post("/api/auth/resend-verification", authMiddleware, asyncHandler(async (req, res) => {
  const freshJugador = await getJugadorById(req.jugador.id);
  if (!freshJugador) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  if (freshJugador.email_verificado) {
    return res.status(409).json({ message: "Tu correo ya fue verificado." });
  }

  const lastSentAt = freshJugador.email_verification_sent_at
    ? new Date(freshJugador.email_verification_sent_at).getTime()
    : 0;

  if (lastSentAt && Date.now() - lastSentAt < EMAIL_RESEND_COOLDOWN_MS) {
    return res.status(429).json({
      message: "Espera un minuto antes de volver a solicitar el correo de verificacion.",
    });
  }

  const verification = await issueEmailVerification(freshJugador, req);
  return res.json({
    verificationEmailSent: verification.sent,
    message: verification.sent
      ? "Te reenviamos el enlace de verificacion a tu correo."
      : "No se pudo enviar el correo automatico. Revisa la configuracion SMTP del servidor.",
  });
}));

app.post("/api/auth/password/forgot", asyncHandler(async (req, res) => {
  const normalizedEmail = String(req.body?.email || "").trim().toLowerCase();
  const genericResponse = {
    message: "Si el correo existe, te enviaremos un enlace para restablecer tu contrasena.",
  };

  if (!normalizedEmail) {
    return res.json(genericResponse);
  }

  const jugador = await getJugadorByCorreo(normalizedEmail);
  if (!jugador) {
    return res.json(genericResponse);
  }

  const lastSentAt = jugador.password_reset_sent_at
    ? new Date(jugador.password_reset_sent_at).getTime()
    : 0;

  if (!lastSentAt || Date.now() - lastSentAt >= PASSWORD_RESET_RESEND_COOLDOWN_MS) {
    await issuePasswordReset(jugador, req);
  }

  return res.json(genericResponse);
}));

app.post("/api/auth/password/reset", asyncHandler(async (req, res) => {
  const rawToken = String(req.body?.token || "").trim();
  const newPassword = String(req.body?.newPassword || "").trim();

  if (!rawToken || !newPassword) {
    return res.status(400).json({ message: "Token y nueva contrasena son obligatorios." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "La nueva contrasena debe tener al menos 6 caracteres." });
  }

  const nowIso = new Date().toISOString();
  const result = await resetPasswordByTokenHash(hashVerificationToken(rawToken), nowIso, newPassword);

  if (result.status === "invalid") {
    return res.status(400).json({ message: "El enlace de recuperacion no es valido." });
  }

  if (result.status === "expired") {
    if (result.jugador?.id) {
      await clearExpiredPasswordResetToken(result.jugador.id);
    }
    return res.status(410).json({ message: "El enlace de recuperacion expiro. Solicita uno nuevo." });
  }

  return res.json({ message: "Contrasena actualizada correctamente. Ya puedes iniciar sesion." });
}));

app.get("/auth/verify-email", asyncHandler(async (req, res) => {
  const rawToken = String(req.query?.token || "").trim();
  const redirectBase = `${getAppBaseUrl(req)}/?tab=partidas`;

  if (!rawToken) {
    return res.redirect(`${redirectBase}&emailVerification=invalid`);
  }

  const nowIso = new Date().toISOString();
  const verificationResult = await verifyEmailByTokenHash(hashVerificationToken(rawToken), nowIso);

  if (verificationResult.status === "expired" && verificationResult.jugador?.id) {
    await clearExpiredEmailVerificationToken(verificationResult.jugador.id);
  }

  return res.redirect(`${redirectBase}&emailVerification=${verificationResult.status}`);
}));

app.get("/auth/reset-password", (req, res) => {
  const rawToken = String(req.query?.token || "").trim();
  const target = `/reset-password.html${rawToken ? `?token=${encodeURIComponent(rawToken)}` : ""}`;
  return res.redirect(target);
});

app.post("/api/auth/logout", authMiddleware, asyncHandler(async (req, res) => {
  await deleteSesion(req.token);
  return res.json({ message: "Sesion cerrada" });
}));

app.get("/api/me", authMiddleware, asyncHandler(async (req, res) => {
  const freshJugador = await getJugadorById(req.jugador.id);
  return res.json({ user: await buildProfile(freshJugador) });
}));

app.get("/api/events", asyncHandler(async (req, res) => {
  const events = (await getEventosConDisponibilidad()).map((event) => {
    const inscriptionValidation = validateInscriptionWindow(event.fecha);
    return {
      id: event.id,
      title: event.titulo,
      date: event.fecha,
      level: event.nivel,
      price: event.precio,
      slots: event.cupos,
      availableSlots: event.cupos_disponibles,
      canInscribe: inscriptionValidation.canInscribe,
      inscriptionStart: inscriptionValidation.inscriptionStart,
      inscriptionEnd: inscriptionValidation.inscriptionEnd,
      inscriptionMessage: inscriptionValidation.error,
    };
  });

  return res.json({ events });
}));

app.get("/api/seasons/current", authMiddleware, asyncHandler(async (req, res) => {
  return res.json({ season: mapTemporada(await getTemporadaActual()) });
}));

app.post("/api/payments/prepare", authMiddleware, asyncHandler(async (req, res) => {
  cleanupExpiredPayments();

  const eventId = String(req.body?.eventId || "").trim();
  const team = String(req.body?.team || "").trim().toLowerCase();
  const eligibility = await validateReservationEligibility(req.jugador.id, eventId, team);

  if (!eligibility.ok) {
    return res.status(eligibility.status).json({ message: eligibility.message });
  }

  const paymentToken = uuidv4();
  pendingPayments.set(paymentToken, {
    jugadorId: req.jugador.id,
    eventId,
    team,
    status: "prepared",
    amount: eligibility.event.precio,
    eventTitle: eligibility.event.titulo,
    createdAt: new Date().toISOString(),
    paidAt: null,
  });

  return res.status(201).json({
    paymentToken,
    event: {
      id: eligibility.event.id,
      title: eligibility.event.titulo,
      price: eligibility.event.precio,
      team,
    },
    expiresInMinutes: 15,
  });
}));

app.post("/api/payments/confirm", authMiddleware, (req, res) => {
  cleanupExpiredPayments();

  const paymentToken = String(req.body?.paymentToken || "").trim();
  const payment = pendingPayments.get(paymentToken);

  if (!payment) {
    return res.status(404).json({ message: "Pago no encontrado o vencido. Intenta nuevamente." });
  }

  if (payment.jugadorId !== req.jugador.id) {
    return res.status(403).json({ message: "No puedes confirmar este pago." });
  }

  if (payment.status === "paid") {
    return res.json({
      payment: {
        id: paymentToken,
        status: "paid",
        amount: payment.amount,
        eventTitle: payment.eventTitle,
        paidAt: payment.paidAt,
      },
    });
  }

  payment.status = "paid";
  payment.paidAt = new Date().toISOString();
  pendingPayments.set(paymentToken, payment);

  return res.json({
    payment: {
      id: paymentToken,
      status: "paid",
      amount: payment.amount,
      eventTitle: payment.eventTitle,
      paidAt: payment.paidAt,
    },
  });
});

app.post("/api/events/:eventId/reserve", authMiddleware, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const team = String(req.body?.team || "").trim().toLowerCase();
  const paymentToken = String(req.body?.paymentToken || "").trim();

  cleanupExpiredPayments();

  if (!paymentToken) {
    return res.status(400).json({ message: "Debes completar el pago antes de inscribirte." });
  }

  const payment = pendingPayments.get(paymentToken);
  if (!payment) {
    return res.status(404).json({ message: "Pago no encontrado o vencido. Vuelve a pagar e intenta nuevamente." });
  }

  if (payment.jugadorId !== req.jugador.id) {
    return res.status(403).json({ message: "Este pago no corresponde a tu cuenta." });
  }

  if (payment.eventId !== eventId || payment.team !== team) {
    return res.status(409).json({ message: "El pago no coincide con la partida o el equipo seleccionado." });
  }

  if (payment.status !== "paid") {
    return res.status(409).json({ message: "Debes confirmar el pago antes de inscribirte." });
  }

  const eligibility = await validateReservationEligibility(req.jugador.id, eventId, team);
  if (!eligibility.ok) {
    return res.status(eligibility.status).json({ message: eligibility.message });
  }

  const event = eligibility.event;

  const reservation = {
    id: uuidv4(),
    jugador_id: req.jugador.id,
    evento_id: event.id,
    evento_titulo: event.titulo,
    evento_fecha: event.fecha,
    equipo: team,
    estado: "upcoming",
    resultado: null,
    created_at: new Date().toISOString(),
  };

  await createReserva(reservation);
  pendingPayments.delete(paymentToken);

  const freshJugador = await getJugadorById(req.jugador.id);
  return res.status(201).json({
    reservation: mapReserva(reservation),
    user: await buildProfile(freshJugador),
  });
}));

app.post("/api/reservations/:reservationId/result", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const { reservationId } = req.params;
  const result = String(req.body?.result || "").trim().toLowerCase();

  if (!["win", "loss"].includes(result)) {
    return res.status(400).json({ message: "El resultado debe ser win o loss" });
  }

  const reservation = await getReservaById(reservationId);
  if (!reservation) {
    return res.status(404).json({ message: "Reserva no encontrada" });
  }

  if (reservation.estado !== "upcoming") {
    return res.status(409).json({ message: "Esta reserva ya fue cerrada" });
  }

  await setResultadoReserva(reservationId, reservation.jugador_id, result);

  const freshReservation = await getReservaById(reservationId);
  const freshPlayer = await getJugadorById(reservation.jugador_id);

  return res.json({
    reservation: mapReserva(freshReservation),
    player: await buildProfile(freshPlayer),
  });
}));

app.get("/api/moderation/reservations", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const reservations = (await getReservasParaModeracion()).map(mapReservaModeracion);
  return res.json({ reservations });
}));

app.get("/api/moderation/events", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const events = (await getEventosParaModeracion()).map(mapEventoModeracion);
  return res.json({ events });
}));

app.post("/api/moderation/events", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const FIXED_EVENT_PRICE = "$8000";
  const title = String(req.body?.title || "").trim();
  const date = String(req.body?.date || "").trim();
  const level = String(req.body?.level || "Intermedio").trim() || "Intermedio";
  const slots = Number.parseInt(req.body?.slots, 10);

  if (!title || !date || Number.isNaN(slots)) {
    return res.status(400).json({
      message: "title, date, level y slots son obligatorios para crear una partida.",
    });
  }

  if (slots <= 0) {
    return res.status(400).json({ message: "Los cupos deben ser un numero mayor a 0" });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "Fecha invalida para la partida" });
  }

  const event = {
    id: uuidv4(),
    titulo: title,
    fecha: date,
    nivel: level,
    precio: FIXED_EVENT_PRICE,
    cupos: slots,
    inscription_start: getMondayOfWeek(date),
  };

  await createEvento(event);
  return res.status(201).json({ event: mapEventoModeracion({ ...event, cupos_disponibles: slots, inscritos_totales: 0, inscritos_pendientes: 0, inscritos_cerrados: 0 }) });
}));

app.delete("/api/moderation/events/:eventId", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const event = await getEventoById(eventId);

  if (!event) {
    return res.status(404).json({ message: "Partida no encontrada" });
  }

  const result = await deleteEventoSiSinReservas(eventId);
  if (!result.deleted) {
    return res.status(409).json({
      message: "No puedes cancelar esta partida porque tiene integrantes inscritos.",
    });
  }

  return res.json({ message: "Partida cancelada correctamente", eventId });
}));

app.get("/api/moderation/players", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const players = (await getJugadoresRegistrados()).map(mapJugadorModeracion);
  return res.json({ players });
}));

app.post("/api/moderation/reservations/:reservationId/team", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const { reservationId } = req.params;
  const team = String(req.body?.team || "").trim().toLowerCase();

  if (!["rojo", "azul"].includes(team)) {
    return res.status(400).json({ message: "El equipo debe ser rojo o azul" });
  }

  const reservation = await getReservaById(reservationId);
  if (!reservation) {
    return res.status(404).json({ message: "Reserva no encontrada" });
  }

  if (reservation.estado !== "upcoming") {
    return res.status(409).json({ message: "Solo puedes cambiar el equipo de reservas pendientes" });
  }

  const updated = await setEquipoReservaModeracion(reservationId, team);
  if (!updated) {
    return res.status(409).json({ message: "No fue posible actualizar el equipo" });
  }

  const allReservations = await getReservasParaModeracion();
  const freshReservation = allReservations.find((item) => item.id === reservationId);
  return res.json({ reservation: freshReservation ? mapReservaModeracion(freshReservation) : null });
}));

app.post("/api/moderation/events/:eventId/result", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const winningTeam = String(req.body?.winningTeam || "").trim().toLowerCase();

  if (!["rojo", "azul"].includes(winningTeam)) {
    return res.status(400).json({ message: "El equipo ganador debe ser rojo o azul" });
  }

  const event = await getEventoById(eventId);
  if (!event) {
    return res.status(404).json({ message: "Partida no encontrada" });
  }

  const activeReservations = await getReservasActivasPorEvento(eventId);
  if (activeReservations.length === 0) {
    return res.status(409).json({ message: "La partida no tiene reservas pendientes por cerrar" });
  }

  const updatedCount = await setResultadosEventoPorEquipo(eventId, winningTeam);
  const allReservations = await getReservasParaModeracion();
  const reservations = allReservations
    .filter((reservation) => reservation.evento_id === eventId)
    .map(mapReservaModeracion);

  return res.json({
    event: {
      id: event.id,
      title: event.titulo,
      winningTeam,
      updatedCount,
    },
    reservations,
  });
}));

app.post("/api/moderation/seasons/end", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const temporada = await getTemporadaActual();
  if (!temporada) {
    return res.status(409).json({ message: "No hay temporada activa para cerrar" });
  }

  const activeReservations = await countReservasActivasTemporada();
  if (activeReservations > 0) {
    return res.status(409).json({
      message: "Debes cerrar primero todas las partidas pendientes antes de terminar la temporada",
    });
  }

  const closedSeason = await cerrarTemporadaActiva();
  return res.json({ season: mapTemporada(closedSeason) });
}));

app.post("/api/moderation/seasons/start", authMiddleware, moderatorMiddleware, asyncHandler(async (req, res) => {
  const activeSeason = await getTemporadaActual();
  if (activeSeason) {
    return res.status(409).json({
      message: "Ya existe una temporada activa. Cierrala antes de iniciar una nueva.",
    });
  }

  const newSeason = await iniciarNuevaTemporada();
  return res.status(201).json({ season: mapTemporada(newSeason) });
}));

app.use(express.static(path.join(__dirname, "..")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor" });
});

module.exports = app;
