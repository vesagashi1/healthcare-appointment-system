const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const canAccessWardPatient = require("../middlewares/canAccessWardPatient");
const canAccessPatient = require("../middlewares/patientAccess.middleware");
const canDoctorWritePatient = require("../middlewares/canDoctorWritePatient");
const auditLog = require("../middlewares/auditLogger");
const pool = require("../config/db");

const router = express.Router();

/**
 * CREATE patient record
 */
router.post(
  "/:patientId/records",
  authMiddleware,
  hasPermission("CREATE_PATIENT_RECORD"),
  canDoctorWritePatient, // doctors
  canAccessPatient,      // nurses / caregivers
  async (req, res) => {
    const { patientId } = req.params;
    const { record_type, content } = req.body;
    const createdBy = req.user.id;

    if (!record_type || !content) {
      return res.status(400).json({
        message: "record_type and content are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO patient_records
        (patient_id, created_by, record_type, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [patientId, createdBy, record_type, content]
    );

    await auditLog({
      req,
      action: "CREATE_PATIENT_RECORD",
      patientId,
    });

    res.status(201).json({
      message: "Medical record created",
      record: result.rows[0],
    });
  }
);

/**
 * GET patient records
 */
router.get(
  "/:patientId/records",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  canAccessWardPatient,
  canAccessPatient,
  async (req, res) => {
    const { patientId } = req.params;
    const { role } = req.user;

    let query = `
      SELECT *
      FROM patient_records
      WHERE patient_id = $1
    `;
    const values = [patientId];

    if (role === "patient") {
      query += ` AND record_type = 'patient_note'`;
    }

    if (role === "nurse" || role === "caregiver") {
      query += ` AND record_type IN ('nursing_note', 'patient_note')`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, values);

    await auditLog({
      req,
      action: "VIEW_PATIENT_RECORDS",
      patientId,
    });

    res.json({
      message: "Patient medical records",
      patientId,
      records: result.rows,
    });
  }
);

module.exports = router;
