const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "healthcare_db",
});

pool.query("SELECT current_database()", (err, res) => {
  if (err) {
    console.error("DB connection check failed:", err.message);
    return;
  }

  console.log("Connected to DB:", res.rows[0].current_database);
});

module.exports = pool;
