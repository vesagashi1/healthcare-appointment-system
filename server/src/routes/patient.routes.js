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
 * POST create record for my profile
 * Create a record for current user's patient profile
 */
router.post(
  "/my-profile/records",
  authMiddleware,
  hasPermission("CREATE_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const { record_type, content } = req.body;
      const userId = req.user.id;
      const role = req.user.role;

      if (!record_type || !content) {
        return res.status(400).json({
          message: "record_type and content are required",
        });
      }

      const patientResult = await pool.query(
        "SELECT user_id FROM patients WHERE user_id = $1",
        [userId]
      );

      if (patientResult.rowCount === 0 && role === "patient") {
        return res.status(404).json({ message: "Patient profile not found" });
      }

      const patientUserId = role === "patient" ? userId : null;
      
      if (!patientUserId) {
        return res.status(400).json({
          message: "Please specify patient_id when creating records as admin/doctor",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO patient_records
          (patient_id, created_by, record_type, content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [patientUserId, userId, record_type, content]
      );

      await auditLog({
        req,
        action: "CREATE_PATIENT_RECORD",
        patientId: patientUserId,
      });

      res.status(201).json({
        message: "Medical record created",
        record: result.rows[0],
      });
    } catch (err) {
      console.error("CREATE MY RECORD ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

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

    const patientCheck = await pool.query(
      "SELECT user_id FROM patients WHERE id = $1",
      [patientId]
    );

    if (patientCheck.rowCount === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patientUserId = patientCheck.rows[0].user_id;

    const result = await pool.query(
      `
      INSERT INTO patient_records
        (patient_id, created_by, record_type, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [patientUserId, createdBy, record_type, content]
    );

    await auditLog({
      req,
      action: "CREATE_PATIENT_RECORD",
      patientId: patientUserId,
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
 * GET my records
 * Get current patient's own records
 */
router.get(
  "/my-profile/records",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;

      let query = `
        SELECT 
          pr.*,
          u.name as patient_name,
          u.email as patient_email,
          creator.name as created_by_name,
          original.id as original_record_id,
          original.content as original_content
        FROM patient_records pr
        JOIN users u ON pr.patient_id = u.id
        LEFT JOIN users creator ON pr.created_by = creator.id
        LEFT JOIN patient_records original ON pr.corrected_record_id = original.id
        WHERE 1=1
      `;
      const values = [];
      let paramCount = 0;

      if (role === "patient") {
        const patientResult = await pool.query(
          `
          SELECT id
          FROM patients
          WHERE user_id = $1
          `,
          [userId]
        );

        if (patientResult.rowCount === 0) {
          return res.status(404).json({ message: "Patient profile not found" });
        }

        query += ` AND pr.patient_id = $${++paramCount} AND pr.record_type = 'patient_note'`;
        values.push(userId);
      } else if (role === "nurse" || role === "caregiver") {
        const patientResult = await pool.query(
          `
          SELECT id
          FROM patients
          WHERE user_id = $1
          `,
          [userId]
        );

        if (patientResult.rowCount > 0) {
          query += ` AND pr.patient_id = $${++paramCount} AND pr.record_type IN ('nursing_note', 'patient_note')`;
          values.push(userId);
        } else {
          query += ` AND pr.record_type IN ('nursing_note', 'patient_note')`;
        }
      } else if (role === "admin" || role === "doctor") {
      }

      query += ` ORDER BY pr.created_at DESC`;

      const result = await pool.query(query, values);

      res.json({
        message: "Patient medical records",
        records: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET MY RECORDS ERROR:", err);
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

      const check = await pool.query(
        `SELECT id FROM patients WHERE id = $1`,
        [patientId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      if (ward_id !== undefined) {
        await pool.query(
          `UPDATE patients SET ward_id = $1 WHERE id = $2`,
          [ward_id, patientId]
        );
      }

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
    try {
      const { patientId } = req.params;
      const { role } = req.user;

      const patientCheck = await pool.query(
        "SELECT user_id FROM patients WHERE id = $1",
        [patientId]
      );

      if (patientCheck.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const patientUserId = patientCheck.rows[0].user_id;

      let query = `
        SELECT 
          pr.*,
          u.name as patient_name,
          u.email as patient_email,
          creator.name as creator_name,
          creator.email as creator_email,
          CASE WHEN pr.record_type = 'void' THEN true ELSE false END as is_void
        FROM patient_records pr
        JOIN users u ON pr.patient_id = u.id
        LEFT JOIN users creator ON pr.created_by = creator.id
        WHERE pr.patient_id = $1
      `;
      const values = [patientUserId];

      if (role === "patient") {
        query += ` AND pr.record_type = 'patient_note'`;
      }

      if (role === "nurse" || role === "caregiver") {
        query += ` AND pr.record_type IN ('nursing_note', 'patient_note')`;
      }

      query += ` ORDER BY pr.created_at DESC`;

      const result = await pool.query(query, values);

      res.json({
        message: "Patient medical records",
        patientId,
        records: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET PATIENT RECORDS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PATCH correct patient record
 * Medical records are immutable, so we create a correction record instead
 * (admin, doctor only)
 */
router.patch(
  "/records/:recordId",
  authMiddleware,
  hasPermission("CREATE_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { record_type, content } = req.body;
      const role = req.user.role;

      if (!["admin", "doctor"].includes(role)) {
        return res.status(403).json({
          message: "Only admin and doctor can correct records",
        });
      }

      if (!record_type || !content) {
        return res.status(400).json({
          message: "record_type and content are required",
        });
      }

      const originalRecord = await pool.query(
        "SELECT id, patient_id, record_type, content FROM patient_records WHERE id = $1",
        [recordId]
      );

      if (originalRecord.rowCount === 0) {
        return res.status(404).json({ message: "Record not found" });
      }

      const original = originalRecord.rows[0];
      const createdBy = req.user.id;

      const result = await pool.query(
        `
        INSERT INTO patient_records
          (patient_id, created_by, record_type, content, corrected_record_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [original.patient_id, createdBy, record_type, content, original.id]
      );

      await auditLog({
        req,
        action: "CORRECT_PATIENT_RECORD",
        patientId: original.patient_id,
      });

      res.json({
        message: "Record correction created successfully",
        record: result.rows[0],
        original_record_id: original.id,
      });
    } catch (err) {
      console.error("CORRECT RECORD ERROR:", err);
      res.status(500).json({ message: "Server error: " + err.message });
    }
  }
);

/**
 * DELETE patient record
 * Medical records are immutable, so deletion is not allowed
 * Instead, we can mark it as voided by creating a void record
 * (admin, doctor only)
 */
router.delete(
  "/records/:recordId",
  authMiddleware,
  hasPermission("CREATE_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const role = req.user.role;

      if (!["admin", "doctor"].includes(role)) {
        return res.status(403).json({
          message: "Only admin and doctor can void records",
        });
      }

      const check = await pool.query(
        "SELECT id, patient_id FROM patient_records WHERE id = $1",
        [recordId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Record not found" });
      }

      const createdBy = req.user.id;
      await pool.query(
        `
        INSERT INTO patient_records
          (patient_id, created_by, record_type, content, corrected_record_id)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          check.rows[0].patient_id,
          createdBy,
          "void",
          `Original record #${recordId} has been voided`,
          recordId,
        ]
      );

      await auditLog({
        req,
        action: "VOID_PATIENT_RECORD",
        patientId: check.rows[0].patient_id,
      });

      res.json({
        message: "Record voided successfully (original record preserved for audit)",
      });
    } catch (err) {
      console.error("VOID RECORD ERROR:", err);
      res.status(500).json({ message: "Server error: " + err.message });
    }
  }
);

module.exports = router;
