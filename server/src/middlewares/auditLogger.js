const pool = require("../config/db");

const auditLog = async ({ req, action, patientId }) => {
  try {
    const user = req.user;

    await pool.query(
      `
      INSERT INTO audit_logs (user_id, role, action, patient_id, ip_address)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        user.id,
        user.role,
        action,
        patientId || null,
        req.ip,
      ]
    );
  } catch (err) {
    console.error("AUDIT LOG ERROR:", err);
  }
};

module.exports = auditLog;
