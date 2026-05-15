const { Pool } = require("pg");
const dns = require("dns");

function parseBooleanEnv(name) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return undefined;
  return ["1", "true", "yes", "on"].includes(String(rawValue).trim().toLowerCase());
}

function shouldUseSsl(databaseUrl) {
  const explicitSsl = parseBooleanEnv("DB_SSL");
  if (explicitSsl !== undefined) return explicitSsl;

  if (process.env.NODE_ENV === "production") return true;
  if (typeof databaseUrl !== "string") return false;
  return databaseUrl.includes("supabase.co") || databaseUrl.includes("neon.tech");
}

function getSslConfig(databaseUrl) {
  if (!shouldUseSsl(databaseUrl)) return false;

  const explicitRejectUnauthorized = parseBooleanEnv("DB_SSL_REJECT_UNAUTHORIZED");
  return {
    rejectUnauthorized: explicitRejectUnauthorized === undefined ? false : explicitRejectUnauthorized,
  };
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL no esta definida. Configura tu conexion PostgreSQL en variables de entorno.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: getSslConfig(databaseUrl),
  lookup: (hostname, _options, callback) => dns.lookup(hostname, { family: 4 }, callback),
});

const moderatorEmails = ["juan.erazo.gajardo@gmail.com"];
const moderatorEmailSet = new Set(moderatorEmails.map((email) => String(email).trim().toLowerCase()));
const FIXED_EVENT_PRICE = "$8000";

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jugadores (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE,
      contrasena TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'user',
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
      CONSTRAINT fk_sesiones_jugador FOREIGN KEY (jugador_id) REFERENCES jugadores (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      nivel TEXT NOT NULL,
      precio TEXT NOT NULL,
      cupos INTEGER NOT NULL,
      inscription_start TEXT
    );

    CREATE TABLE IF NOT EXISTS temporadas (
      id SERIAL PRIMARY KEY,
      numero INTEGER NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      estado TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      jugador_id TEXT NOT NULL,
      evento_id TEXT NOT NULL,
      evento_titulo TEXT NOT NULL,
      evento_fecha TEXT NOT NULL,
      temporada_id INTEGER,
      equipo TEXT NOT NULL DEFAULT 'rojo',
      estado TEXT NOT NULL,
      resultado TEXT,
      created_at TEXT NOT NULL,
      CONSTRAINT fk_reservas_jugador FOREIGN KEY (jugador_id) REFERENCES jugadores (id) ON DELETE CASCADE,
      CONSTRAINT fk_reservas_evento FOREIGN KEY (evento_id) REFERENCES eventos (id) ON DELETE CASCADE,
      CONSTRAINT fk_reservas_temporada FOREIGN KEY (temporada_id) REFERENCES temporadas (id)
    );
  `);

  await pool.query(`
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS email_verification_expires_at TEXT;
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS email_verification_sent_at TEXT;
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS password_reset_expires_at TEXT;
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS password_reset_sent_at TEXT;
  `);

  for (const email of moderatorEmails) {
    await pool.query(
      "UPDATE jugadores SET rol = 'moderator' WHERE LOWER(TRIM(correo)) = $1 AND rol != 'moderator'",
      [email.trim().toLowerCase()]
    );
  }

  await ensureTemporadaActiva();

  const { rows: countRows } = await pool.query("SELECT COUNT(*) AS total FROM eventos");
  const countEvents = parseInt(countRows[0].total, 10);

  if (countEvents === 0) {
    const seedEvents = buildSeedEventsForCurrentWeek();
    for (const event of seedEvents) {
      await pool.query(
        "INSERT INTO eventos (id, titulo, fecha, nivel, precio, cupos, inscription_start) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [event.id, event.titulo, event.fecha, event.nivel, event.precio, event.cupos, event.inscription_start]
      );
    }
  } else {
    const { rows: reservationRows } = await pool.query("SELECT COUNT(*) AS total FROM reservas");
    if (parseInt(reservationRows[0].total, 10) === 0) {
      const defaultIds = seedEventTemplates.map((e) => e.id);
      const placeholders = defaultIds.map((_, i) => `$${i + 1}`).join(", ");
      const { rows: existingEvents } = await pool.query(
        `SELECT id, fecha FROM eventos WHERE id IN (${placeholders})`,
        defaultIds
      );

      if (existingEvents.length === defaultIds.length) {
        const currentWeekSeed = buildSeedEventsForCurrentWeek();
        const currentWeekSeedById = new Map(currentWeekSeed.map((e) => [e.id, e]));

        const needsSync = existingEvents.some((event) => {
          const expected = currentWeekSeedById.get(event.id);
          return expected && event.fecha !== expected.fecha;
        });

        if (needsSync) {
          for (const row of currentWeekSeed) {
            await pool.query(
              "UPDATE eventos SET titulo = $1, fecha = $2, nivel = $3, precio = $4, cupos = $5, inscription_start = $6 WHERE id = $7",
              [row.titulo, row.fecha, row.nivel, row.precio, row.cupos, row.inscription_start, row.id]
            );
          }
        }
      }
    }
  }

  // Precio estandar para todas las partidas, incluidas las ya existentes.
  await pool.query("UPDATE eventos SET precio = $1", [FIXED_EVENT_PRICE]);
}

function isModeratorEmail(correo) {
  return moderatorEmailSet.has(String(correo || "").trim().toLowerCase());
}

async function ensureModeratorRoleForEmail(correo) {
  const normalizedEmail = String(correo || "").trim().toLowerCase();
  if (!isModeratorEmail(normalizedEmail)) return 0;
  const result = await pool.query(
    "UPDATE jugadores SET rol = 'moderator' WHERE LOWER(TRIM(correo)) = $1 AND rol != 'moderator'",
    [normalizedEmail]
  );
  return result.rowCount || 0;
}

async function createSeason(numero) {
  const now = new Date().toISOString();
  await pool.query(
    "INSERT INTO temporadas (numero, nombre, estado, started_at, ended_at) VALUES ($1, $2, 'active', $3, NULL)",
    [numero, `Temporada ${numero}`, now]
  );
}

async function getTemporadaActual() {
  const { rows } = await pool.query(
    "SELECT * FROM temporadas WHERE estado = 'active' ORDER BY numero DESC LIMIT 1"
  );
  return rows[0] || null;
}

async function ensureTemporadaActiva() {
  const active = await getTemporadaActual();
  if (active) return active;

  const { rows } = await pool.query("SELECT COALESCE(MAX(numero), 0) AS numero FROM temporadas");
  const nextNumero = (parseInt(rows[0]?.numero, 10) || 0) + 1;
  await createSeason(nextNumero);
  return getTemporadaActual();
}

// Funciones helper para gestionar fechas de inscripción
function getMondayOfWeek(dateString) {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay();
  // Calcular diferencia al lunes (1)
  // Domingo (0) -> 6 días atrás, Lunes (1) -> 0 días, Martes (2) -> 1 día atrás, etc
  const daysToSubtract = (dayOfWeek + 6) % 7;
  
  const monday = new Date(date);
  monday.setDate(monday.getDate() - daysToSubtract);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function getSundayOfWeek(dateString) {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay();
  // Calcular diferencia al domingo (0)
  let daysToAdd = (7 - dayOfWeek) % 7;
  if (dayOfWeek === 0) daysToAdd = 0; // ya es domingo
  
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() + daysToAdd);
  sunday.setHours(23, 59, 59, 999);
  return sunday.toISOString();
}

function validateInscriptionWindow(eventDate) {
  const now = new Date();
  const monday = new Date(getMondayOfWeek(eventDate));
  const sunday = new Date(getSundayOfWeek(eventDate));
  
  return {
    canInscribe: now >= monday && now <= sunday,
    inscriptionStart: monday.toISOString(),
    inscriptionEnd: sunday.toISOString(),
    error: now < monday ? "La inscripcion aun no ha abierto. Se abre el lunes a las 00:00 de esta semana." : 
           now > sunday ? "La inscripcion ha cerrado. Solo se permite inscribirse de lunes 00:00 a domingo 23:59." : null
  };
}


const seedEventTemplates = [
  {
    id: "evt-1",
    titulo: "Operacion Tactica Nocturna",
    weekday: 5,
    hour: 20,
    minute: 0,
    nivel: "Intermedio",
    precio: FIXED_EVENT_PRICE,
    cupos: 40,
  },
  {
    id: "evt-2",
    titulo: "CQB Sabado | Turno Manana",
    weekday: 6,
    hour: 10,
    minute: 30,
    nivel: "Principiante",
    precio: FIXED_EVENT_PRICE,
    cupos: 40,
  },
  {
    id: "evt-3",
    titulo: "CQB Sabado | Turno Tarde",
    weekday: 6,
    hour: 17,
    minute: 0,
    nivel: "Intermedio",
    precio: FIXED_EVENT_PRICE,
    cupos: 40,
  },
  {
    id: "evt-4",
    titulo: "CQB Domingo | Turno Manana",
    weekday: 7,
    hour: 11,
    minute: 0,
    nivel: "Principiante",
    precio: FIXED_EVENT_PRICE,
    cupos: 40,
  },
  {
    id: "evt-5",
    titulo: "Liga Squad Domingo | Turno Tarde",
    weekday: 7,
    hour: 16,
    minute: 30,
    nivel: "Avanzado",
    precio: FIXED_EVENT_PRICE,
    cupos: 40,
  },
];

function toLocalIsoWithoutTimezone(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getCurrentWeekMondayDate() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToSubtract = (dayOfWeek + 6) % 7;

  const monday = new Date(now);
  monday.setDate(monday.getDate() - daysToSubtract);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildSeedEventsForCurrentWeek() {
  const monday = getCurrentWeekMondayDate();

  return seedEventTemplates.map((template) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + (template.weekday - 1));
    date.setHours(template.hour, template.minute, 0, 0);

    const fecha = toLocalIsoWithoutTimezone(date);

    return {
      id: template.id,
      titulo: template.titulo,
      fecha,
      nivel: template.nivel,
      precio: template.precio,
      cupos: template.cupos,
      inscription_start: getMondayOfWeek(fecha),
    };
  });
}

async function getJugadorByCorreo(correo) {
  const { rows } = await pool.query("SELECT * FROM jugadores WHERE correo = $1", [correo]);
  return rows[0] || null;
}

async function getJugadorById(id) {
  const { rows } = await pool.query("SELECT * FROM jugadores WHERE id = $1", [id]);
  return rows[0] || null;
}

async function createJugador(jugador) {
  await pool.query(
    `INSERT INTO jugadores
      (id, nombre, correo, contrasena, rol, victorias, derrotas, partidas_jugadas, reservas_activas, created_at, email_verificado, email_verification_token_hash, email_verification_expires_at, email_verification_sent_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      jugador.id, jugador.nombre, jugador.correo, jugador.contrasena, jugador.rol,
      jugador.victorias, jugador.derrotas, jugador.partidas_jugadas, jugador.reservas_activas, jugador.created_at,
      Boolean(jugador.email_verificado),
      jugador.email_verification_token_hash || null,
      jugador.email_verification_expires_at || null,
      jugador.email_verification_sent_at || null,
    ]
  );
}

async function saveEmailVerificationToken(jugadorId, tokenHash, expiresAt, sentAt) {
  await pool.query(
    `UPDATE jugadores
     SET
       email_verificado = FALSE,
       email_verification_token_hash = $1,
       email_verification_expires_at = $2,
       email_verification_sent_at = $3
     WHERE id = $4`,
    [tokenHash, expiresAt, sentAt, jugadorId]
  );
}

async function verifyEmailByTokenHash(tokenHash, nowIso) {
  const { rows } = await pool.query(
    `SELECT *
     FROM jugadores
     WHERE email_verification_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  const jugador = rows[0] || null;
  if (!jugador) {
    return { status: "invalid", jugador: null };
  }

  if (jugador.email_verification_expires_at && jugador.email_verification_expires_at < nowIso) {
    return { status: "expired", jugador };
  }

  const { rows: updatedRows } = await pool.query(
    `UPDATE jugadores
     SET
       email_verificado = TRUE,
       email_verification_token_hash = NULL,
       email_verification_expires_at = NULL,
       email_verification_sent_at = NULL
     WHERE id = $1
     RETURNING *`,
    [jugador.id]
  );

  return { status: "verified", jugador: updatedRows[0] || jugador };
}

async function clearExpiredEmailVerificationToken(jugadorId) {
  await pool.query(
    `UPDATE jugadores
     SET
       email_verification_token_hash = NULL,
       email_verification_expires_at = NULL
     WHERE id = $1`,
    [jugadorId]
  );
}

async function savePasswordResetToken(jugadorId, tokenHash, expiresAt, sentAt) {
  await pool.query(
    `UPDATE jugadores
     SET
       password_reset_token_hash = $1,
       password_reset_expires_at = $2,
       password_reset_sent_at = $3
     WHERE id = $4`,
    [tokenHash, expiresAt, sentAt, jugadorId]
  );
}

async function resetPasswordByTokenHash(tokenHash, nowIso, newPassword) {
  const { rows } = await pool.query(
    `SELECT *
     FROM jugadores
     WHERE password_reset_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  const jugador = rows[0] || null;
  if (!jugador) {
    return { status: "invalid", jugador: null };
  }

  if (jugador.password_reset_expires_at && jugador.password_reset_expires_at < nowIso) {
    return { status: "expired", jugador };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: updatedRows } = await client.query(
      `UPDATE jugadores
       SET
         contrasena = $1,
         password_reset_token_hash = NULL,
         password_reset_expires_at = NULL,
         password_reset_sent_at = NULL
       WHERE id = $2
       RETURNING *`,
      [newPassword, jugador.id]
    );

    await client.query("DELETE FROM sesiones WHERE jugador_id = $1", [jugador.id]);
    await client.query("COMMIT");

    return { status: "reset", jugador: updatedRows[0] || jugador };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function clearExpiredPasswordResetToken(jugadorId) {
  await pool.query(
    `UPDATE jugadores
     SET
       password_reset_token_hash = NULL,
       password_reset_expires_at = NULL
     WHERE id = $1`,
    [jugadorId]
  );
}

async function upsertSesion(token, jugadorId) {
  await pool.query("DELETE FROM sesiones WHERE jugador_id = $1", [jugadorId]);
  await pool.query(
    "INSERT INTO sesiones (token, jugador_id, created_at) VALUES ($1, $2, $3)",
    [token, jugadorId, new Date().toISOString()]
  );
}

async function getSesionByToken(token) {
  const { rows } = await pool.query("SELECT * FROM sesiones WHERE token = $1", [token]);
  return rows[0] || null;
}

async function deleteSesion(token) {
  await pool.query("DELETE FROM sesiones WHERE token = $1", [token]);
}

async function getReservasByJugador(jugadorId) {
  const temporada = await getTemporadaActual();
  if (!temporada) return [];
  const { rows } = await pool.query(
    "SELECT * FROM reservas WHERE jugador_id = $1 AND temporada_id = $2 ORDER BY evento_fecha ASC",
    [jugadorId, temporada.id]
  );
  return rows;
}

async function getEventosConDisponibilidad() {
  const temporada = await getTemporadaActual();
  const temporadaId = temporada?.id || -1;
  const { rows } = await pool.query(
    `SELECT
      e.id,
      e.titulo,
      e.fecha,
      e.nivel,
      e.precio,
      e.cupos,
      GREATEST(0, e.cupos - COALESCE(r.reservas_activas, 0)) AS cupos_disponibles
    FROM eventos e
    LEFT JOIN (
      SELECT evento_id, COUNT(*) AS reservas_activas
      FROM reservas
      WHERE estado = 'upcoming' AND temporada_id = $1
      GROUP BY evento_id
    ) r ON r.evento_id = e.id
    ORDER BY e.fecha ASC`,
    [temporadaId]
  );
  return rows;
}

async function getEventosParaModeracion() {
  const temporada = await getTemporadaActual();
  const temporadaId = temporada?.id || -1;
  const { rows } = await pool.query(
    `SELECT
      e.id,
      e.titulo,
      e.fecha,
      e.nivel,
      e.precio,
      e.cupos,
      COALESCE(t.total_reservas, 0) AS inscritos_totales,
      COALESCE(t.reservas_activas, 0) AS inscritos_pendientes,
      COALESCE(t.reservas_cerradas, 0) AS inscritos_cerrados,
      GREATEST(0, e.cupos - COALESCE(t.reservas_activas, 0)) AS cupos_disponibles
    FROM eventos e
    LEFT JOIN (
      SELECT
        evento_id,
        COUNT(*) AS total_reservas,
        COUNT(*) FILTER (WHERE estado = 'upcoming') AS reservas_activas,
        COUNT(*) FILTER (WHERE estado = 'played') AS reservas_cerradas
      FROM reservas
      WHERE temporada_id = $1
      GROUP BY evento_id
    ) t ON t.evento_id = e.id
    ORDER BY e.fecha ASC`,
    [temporadaId]
  );
  return rows;
}

async function createEvento(evento) {
  await pool.query(
    `INSERT INTO eventos
      (id, titulo, fecha, nivel, precio, cupos, inscription_start)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      evento.id,
      evento.titulo,
      evento.fecha,
      evento.nivel,
      evento.precio,
      evento.cupos,
      evento.inscription_start || null,
    ]
  );
}

async function deleteEventoSiSinReservas(eventoId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*) AS total FROM reservas WHERE evento_id = $1",
    [eventoId]
  );
  const totalReservas = parseInt(rows[0]?.total, 10) || 0;
  if (totalReservas > 0) {
    return { deleted: false, totalReservas };
  }

  const result = await pool.query("DELETE FROM eventos WHERE id = $1", [eventoId]);
  return { deleted: result.rowCount > 0, totalReservas: 0 };
}

async function getEventoById(eventoId) {
  const { rows } = await pool.query("SELECT * FROM eventos WHERE id = $1", [eventoId]);
  return rows[0] || null;
}

async function hasReservaActiva(jugadorId, eventoId) {
  const temporada = await getTemporadaActual();
  if (!temporada) return false;
  const { rows } = await pool.query(
    "SELECT COUNT(*) AS total FROM reservas WHERE jugador_id = $1 AND evento_id = $2 AND temporada_id = $3 AND estado = 'upcoming'",
    [jugadorId, eventoId, temporada.id]
  );
  return parseInt(rows[0].total, 10) > 0;
}

async function countReservasActivasPorEvento(eventoId) {
  const temporada = await getTemporadaActual();
  if (!temporada) return 0;
  const { rows } = await pool.query(
    "SELECT COUNT(*) AS total FROM reservas WHERE evento_id = $1 AND temporada_id = $2 AND estado = 'upcoming'",
    [eventoId, temporada.id]
  );
  return parseInt(rows[0].total, 10);
}

async function countReservasActivasTemporada() {
  const temporada = await getTemporadaActual();
  if (!temporada) return 0;
  const { rows } = await pool.query(
    "SELECT COUNT(*) AS total FROM reservas WHERE temporada_id = $1 AND estado = 'upcoming'",
    [temporada.id]
  );
  return parseInt(rows[0].total, 10);
}

async function createReserva(reserva) {
  const temporada = await getTemporadaActual();
  if (!temporada) throw new Error("No hay temporada activa");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO reservas
        (id, jugador_id, evento_id, evento_titulo, evento_fecha, temporada_id, equipo, estado, resultado, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        reserva.id, reserva.jugador_id, reserva.evento_id, reserva.evento_titulo,
        reserva.evento_fecha, temporada.id, reserva.equipo, reserva.estado,
        reserva.resultado || null, reserva.created_at,
      ]
    );
    await client.query(
      "UPDATE jugadores SET reservas_activas = reservas_activas + 1 WHERE id = $1",
      [reserva.jugador_id]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getReservaByIdForJugador(reservaId, jugadorId) {
  const { rows } = await pool.query(
    "SELECT * FROM reservas WHERE id = $1 AND jugador_id = $2",
    [reservaId, jugadorId]
  );
  return rows[0] || null;
}

async function getReservaById(reservaId) {
  const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [reservaId]);
  return rows[0] || null;
}

async function getJugadoresRegistrados() {
  const { rows } = await pool.query(
    `SELECT id, nombre, correo, rol, victorias, derrotas, partidas_jugadas, reservas_activas, created_at
     FROM jugadores
     ORDER BY created_at DESC`
  );
  return rows;
}

async function getReservasParaModeracion() {
  const temporada = await getTemporadaActual();
  if (!temporada) return [];
  const { rows } = await pool.query(
    `SELECT
      r.*,
      j.nombre AS jugador_nombre,
      j.correo AS jugador_correo
    FROM reservas r
    INNER JOIN jugadores j ON j.id = r.jugador_id
    WHERE r.temporada_id = $1
    ORDER BY
      CASE WHEN r.estado = 'upcoming' THEN 0 ELSE 1 END,
      r.evento_fecha ASC,
      r.created_at ASC`,
    [temporada.id]
  );
  return rows;
}

async function getReservasActivasPorEvento(eventoId) {
  const temporada = await getTemporadaActual();
  if (!temporada) return [];
  const { rows } = await pool.query(
    "SELECT * FROM reservas WHERE evento_id = $1 AND temporada_id = $2 AND estado = 'upcoming' ORDER BY created_at ASC",
    [eventoId, temporada.id]
  );
  return rows;
}

async function setEquipoReservaModeracion(reservaId, equipo) {
  const temporada = await getTemporadaActual();
  if (!temporada) return 0;
  const result = await pool.query(
    "UPDATE reservas SET equipo = $1 WHERE id = $2 AND temporada_id = $3 AND estado = 'upcoming'",
    [equipo, reservaId, temporada.id]
  );
  return result.rowCount || 0;
}

async function setResultadoReserva(reservaId, jugadorId, resultado) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE reservas SET estado = 'played', resultado = $1 WHERE id = $2 AND jugador_id = $3",
      [resultado, reservaId, jugadorId]
    );
    await client.query(
      `UPDATE jugadores
       SET
         partidas_jugadas = partidas_jugadas + 1,
         victorias = victorias + CASE WHEN $1 = 'win' THEN 1 ELSE 0 END,
         derrotas = derrotas + CASE WHEN $1 = 'loss' THEN 1 ELSE 0 END,
         reservas_activas = CASE WHEN reservas_activas > 0 THEN reservas_activas - 1 ELSE 0 END
       WHERE id = $2`,
      [resultado, jugadorId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function setResultadosEventoPorEquipo(eventoId, equipoGanador) {
  const reservas = await getReservasActivasPorEvento(eventoId);
  if (reservas.length === 0) return 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const reserva of reservas) {
      const resultado = reserva.equipo === equipoGanador ? "win" : "loss";
      await client.query(
        "UPDATE reservas SET estado = 'played', resultado = $1 WHERE id = $2 AND jugador_id = $3",
        [resultado, reserva.id, reserva.jugador_id]
      );
      await client.query(
        `UPDATE jugadores
         SET
           partidas_jugadas = partidas_jugadas + 1,
           victorias = victorias + CASE WHEN $1 = 'win' THEN 1 ELSE 0 END,
           derrotas = derrotas + CASE WHEN $1 = 'loss' THEN 1 ELSE 0 END,
           reservas_activas = CASE WHEN reservas_activas > 0 THEN reservas_activas - 1 ELSE 0 END
         WHERE id = $2`,
        [resultado, reserva.jugador_id]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return reservas.length;
}

async function cerrarTemporadaActiva() {
  const temporada = await getTemporadaActual();
  if (!temporada) return null;
  const now = new Date().toISOString();
  await pool.query("UPDATE temporadas SET estado = 'ended', ended_at = $1 WHERE id = $2", [now, temporada.id]);
  const { rows } = await pool.query("SELECT * FROM temporadas WHERE id = $1", [temporada.id]);
  return rows[0] || null;
}

async function iniciarNuevaTemporada() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: lastRows } = await client.query("SELECT COALESCE(MAX(numero), 0) AS numero FROM temporadas");
    const nextNumero = (parseInt(lastRows[0]?.numero, 10) || 0) + 1;
    const now = new Date().toISOString();
    const { rows: insertRows } = await client.query(
      "INSERT INTO temporadas (numero, nombre, estado, started_at, ended_at) VALUES ($1, $2, 'active', $3, NULL) RETURNING id",
      [nextNumero, `Temporada ${nextNumero}`, now]
    );
    const newId = insertRows[0].id;
    await client.query(
      "UPDATE jugadores SET victorias = 0, derrotas = 0, partidas_jugadas = 0, reservas_activas = 0"
    );
    const { rows: seasonRows } = await client.query("SELECT * FROM temporadas WHERE id = $1", [newId]);
    await client.query("COMMIT");
    return seasonRows[0] || null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function closeDb() {
  await pool.end();
}

module.exports = {
  initDb,
  closeDb,
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
  getReservaByIdForJugador,
  getReservaById,
  getJugadoresRegistrados,
  getReservasParaModeracion,
  getReservasActivasPorEvento,
  setEquipoReservaModeracion,
  getTemporadaActual,
  countReservasActivasTemporada,
  cerrarTemporadaActiva,
  iniciarNuevaTemporada,
  setResultadoReserva,
  setResultadosEventoPorEquipo,
  getMondayOfWeek,
  getSundayOfWeek,
  validateInscriptionWindow,
  isModeratorEmail,
  ensureModeratorRoleForEmail,
};

