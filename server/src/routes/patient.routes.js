const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const canAccessWardPatient = require("../middlewares/canAccessWardPatient");
const canAccessPatient = require("../middlewares/patientAccess.middleware");
const canDoctorWritePatient = require("../middlewares/canDoctorWritePatient");
const auditLog = require("../middlewares/auditLogger");
const pool = require("../config/db");

const router = express.Router();


router.post(
  "/:patientId/records",
  authMiddleware,
  hasPermission("CREATE_PATIENT_RECORD"),
  canDoctorWritePatient, 
  canAccessPatient,     
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
 * GET all patients
 * List all patients (admin, doctors, nurses only)
 */
router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const { ward_id, name, email } = req.query;
      const role = req.user.role;

      // Only admin, doctors, and nurses can list all patients
      if (!["admin", "doctor", "nurse"].includes(role)) {
        return res.status(403).json({
          message: "Not authorized to view patient list",
        });
      }

      let query = `
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          w.id as ward_id,
          w.name as ward_name,
          u.created_at
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE 1=1
      `;

      const values = [];
      let paramCount = 0;

      if (ward_id) {
        query += ` AND p.ward_id = $${++paramCount}`;
        values.push(ward_id);
      }

      if (name) {
        query += ` AND u.name ILIKE $${++paramCount}`;
        values.push(`%${name}%`);
      }

      if (email) {
        query += ` AND u.email ILIKE $${++paramCount}`;
        values.push(`%${email}%`);
      }

      query += ` ORDER BY u.name ASC`;

      const result = await pool.query(query, values);

      res.json({
        message: "Patients retrieved successfully",
        patients: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET PATIENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET patient by ID
 * Get patient details
 */
router.get(
  "/:patientId",
  authMiddleware,
  canAccessWardPatient,
  canAccessPatient,
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Get patient basic info
      const patientResult = await pool.query(
        `
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          w.id as ward_id,
          w.name as ward_name,
          u.created_at
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE p.id = $1
        `,
        [patientId]
      );

      if (patientResult.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const patient = patientResult.rows[0];

      // Get assigned staff (doctors and nurses)
      const staffResult = await pool.query(
        `
        SELECT 
          pa.id,
          pa.role,
          u.id as staff_user_id,
          u.name as staff_name,
          u.email as staff_email
        FROM patient_assignments pa
        JOIN users u ON pa.staff_id = u.id
        WHERE pa.patient_id = $1
        `,
        [patientId]
      );

      // Get caregivers
      const caregiversResult = await pool.query(
        `
        SELECT 
          pc.id,
          pc.relationship,
          u.id as caregiver_user_id,
          u.name as caregiver_name,
          u.email as caregiver_email,
          pc.created_at
        FROM patient_caregivers pc
        JOIN users u ON pc.caregiver_id = u.id
        WHERE pc.patient_id = $1
        `,
        [patientId]
      );

      res.json({
        message: "Patient retrieved successfully",
        patient: {
          ...patient,
          assigned_staff: staffResult.rows,
          caregivers: caregiversResult.rows,
        },
      });
    } catch (err) {
      console.error("GET PATIENT ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET my profile
 * Get current patient's own profile
 */
router.get(
  "/my-profile/details",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;

      if (role !== "patient") {
        return res.status(403).json({
          message: "Only patients can access their profile",
        });
      }

      const result = await pool.query(
        `
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          w.id as ward_id,
          w.name as ward_name,
          u.created_at
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE p.user_id = $1
        `,
        [userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Patient profile not found" });
      }

      res.json({
        message: "Profile retrieved successfully",
        patient: result.rows[0],
      });
    } catch (err) {
      console.error("GET MY PROFILE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PATCH update patient
 * Update patient information (admin only)
 */
router.patch(
  "/:patientId",
  authMiddleware,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { ward_id } = req.body;
      const role = req.user.role;

      if (role !== "admin") {
        return res.status(403).json({
          message: "Only admin can update patient information",
        });
      }

      // Check if patient exists
      const check = await pool.query(
        `SELECT id FROM patients WHERE id = $1`,
        [patientId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Update ward if provided
      if (ward_id !== undefined) {
        await pool.query(
          `UPDATE patients SET ward_id = $1 WHERE id = $2`,
          [ward_id, patientId]
        );
      }

      // Get updated patient
      const result = await pool.query(
        `
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          w.id as ward_id,
          w.name as ward_name
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE p.id = $1
        `,
        [patientId]
      );

      res.json({
        message: "Patient updated successfully",
        patient: result.rows[0],
      });
    } catch (err) {
      console.error("UPDATE PATIENT ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

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
