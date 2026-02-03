const pool = require("../config/db");

const canAccessPatient = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const patientId = parseInt(req.params.patientId, 10);

    // Admin can access all patients
    if (role === "admin") {
      return next();
    }

    // For doctor role, let canAccessWardPatient middleware handle ward-based access
    if (role === "doctor") {
      return next();
    }

    // For patient role, check if they're accessing their own record
    if (role === "patient") {
      // Get patient's user_id from patients table
      const patientCheck = await pool.query(
        `SELECT user_id FROM patients WHERE id = $1`,
        [patientId]
      );
      
      if (patientCheck.rowCount > 0 && patientCheck.rows[0].user_id === userId) {
        return next();
      }
    }

    // For nurse/caregiver, check assignments
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
