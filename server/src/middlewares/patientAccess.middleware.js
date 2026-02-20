const pool = require("../config/db");

const canAccessPatient = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const patientId = parseInt(req.params.patientId, 10);

    if (Number.isNaN(patientId)) {
      return res.status(400).json({ message: "Invalid patient id" });
    }

    const patientLookup = await pool.query(
      `SELECT id, user_id FROM patients WHERE id = $1`,
      [patientId]
    );

    if (patientLookup.rowCount === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patientUserId = patientLookup.rows[0].user_id;

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
      if (patientUserId === userId) {
        return next();
      }
    }

    // For nurse, check explicit nurse assignment
    if (role === "nurse") {
      const result = await pool.query(
        `
        SELECT 1
        FROM patient_assignments
        WHERE staff_id = $1
          AND patient_id = $2
          AND role = 'nurse'
        `,
        [userId, patientUserId]
      );

      if (result.rowCount > 0) {
        return next();
      }
    }

    // For caregiver, check caregiver links
    if (role === "caregiver") {
      const result = await pool.query(
        `
        SELECT 1
        FROM patient_caregivers
        WHERE caregiver_id = $1
          AND patient_id = $2
        `,
        [userId, patientUserId]
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
