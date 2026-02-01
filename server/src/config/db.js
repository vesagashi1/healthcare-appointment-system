const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.query("SELECT current_database()", (err, res) => {
  if (!err) {
    console.log("Connected to DB:", res.rows[0].current_database);
  }
});

module.exports = pool;
