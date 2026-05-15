require("dotenv").config();

const app = require("./src/app");
const { initDb, closeDb } = require("./src/db");

const PORT = process.env.PORT || 3000;
let server = null;
let shuttingDown = false;

function closeServer() {
  return new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.close((error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[${signal}] Cerrando servidor...`);

  let exitCode = 0;
  try {
    await closeServer();
  } catch (error) {
    exitCode = 1;
    console.error("Error al cerrar el servidor HTTP:", error);
  }

  try {
    await closeDb();
  } catch (error) {
    exitCode = 1;
    console.error("Error al cerrar conexiones de base de datos:", error);
  }

  process.exit(exitCode);
}

initDb()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`CQB backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error al inicializar la base de datos:", err);
    process.exit(1);
  });

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
