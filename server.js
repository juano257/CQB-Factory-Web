require("dotenv").config();

const app = require("./src/app");
const { initDb } = require("./src/db");

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`CQB backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error al inicializar la base de datos:", err);
    process.exit(1);
  });
