const pool = require("../config/db");

const canAccessPatient = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const patientId = parseInt(req.params.patientId, 10);

    if (role === "doctor") {
      return next();
    }

    if (role === "patient" && userId === patientId) {
      return next();
    }

    if (role === "nurse" || role === "caregiver") {
      const result = await pool.query(
        `
        SELECT 1
        FROM patient_caregivers
        WHERE caregiver_id = $1
          AND patient_id = $2
        `,
        [userId, patientId]
      );

      if (result.rowCount > 0) {
        return next();
      }
    }

    return res.status(403).json({
      message: "Not authorized to access this patient",
    });
  } catch (err) {
    console.error("PATIENT ACCESS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = canAccessPatient;
