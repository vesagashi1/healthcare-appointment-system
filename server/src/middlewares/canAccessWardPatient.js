const pool = require("../config/db");

module.exports = async (req, res, next) => {
  try {
    const user = req.user;

    // If not a doctor → let next middleware handle it
    if (user.role !== "doctor") {
      return next();
    }

    const patientId = parseInt(req.params.patientId, 10);

    const result = await pool.query(
      `
      SELECT 1
      FROM patients p
      JOIN doctor_wards dw ON p.ward_id = dw.ward_id
      WHERE p.id = $1
        AND dw.doctor_id = $2
      `,
      [patientId, user.id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({
        message: "Doctor not assigned to patient's ward",
      });
    }

    // ✅ Doctor authorized → STOP here
    return next();
  } catch (err) {
    console.error("WARD ACCESS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
