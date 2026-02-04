/* eslint-disable no-console */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const readSql = (relativePath) => {
  const abs = path.resolve(__dirname, "..", relativePath);
  return fs.readFileSync(abs, "utf8");
};

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || "healthcare_db",
  });

  try {
    const dbCheck = await pool.query("SELECT current_database() as db");
    console.log(`Seeding database: ${dbCheck.rows[0].db}`);

    const migrations = [
      "db/migrations/006_fix_foreign_keys.sql",
      "db/migrations/003_test_data.sql",
      "db/migrations/004_fix_patient_assignment.sql",
    ];

    for (const file of migrations) {
      console.log(`\nRunning: ${file}`);
      const sql = readSql(file);
      await pool.query(sql);
    }

    const summary = await pool.query(
      `
      SELECT 'wards' as table_name, COUNT(*)::int as count FROM wards
      UNION ALL SELECT 'doctors', COUNT(*)::int FROM doctors
      UNION ALL SELECT 'patients', COUNT(*)::int FROM patients
      UNION ALL SELECT 'doctor_wards', COUNT(*)::int FROM doctor_wards
      UNION ALL SELECT 'appointments', COUNT(*)::int FROM appointments
      UNION ALL SELECT 'patient_records', COUNT(*)::int FROM patient_records
      ORDER BY table_name;
      `,
    );

    console.log("\nSeed complete. Counts:");
    for (const row of summary.rows) {
      console.log(`- ${row.table_name}: ${row.count}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
