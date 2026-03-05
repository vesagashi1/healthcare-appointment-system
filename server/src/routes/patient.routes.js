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
        "SELECT id FROM patients WHERE user_id = $1",
        [userId],
      );

      if (patientResult.rowCount === 0 && role === "patient") {
        return res.status(404).json({ message: "Patient profile not found" });
      }

      const patientTableId =
        role === "patient" ? patientResult.rows[0].id : null;

      if (!patientTableId) {
        return res.status(400).json({
          message:
            "Please specify patient_id when creating records as admin/doctor",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO patient_records
          (patient_id, created_by, record_type, content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [patientTableId, userId, record_type, content],
      );

      await auditLog({
        req,
        action: "CREATE_PATIENT_RECORD",
        patientId: patientTableId,
      });

      res.status(201).json({
        message: "Medical record created",
        record: result.rows[0],
      });
    } catch (err) {
      console.error("CREATE MY RECORD ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
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
      "SELECT id FROM patients WHERE id = $1",
      [patientId],
    );

    if (patientCheck.rowCount === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const result = await pool.query(
      `
      INSERT INTO patient_records
        (patient_id, created_by, record_type, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [patientId, createdBy, record_type, content],
    );

    await auditLog({
      req,
      action: "CREATE_PATIENT_RECORD",
      patientId: patientId,
    });

    res.status(201).json({
      message: "Medical record created",
      record: result.rows[0],
    });
  },
);

/**
 * GET all patients
 * List all patients (admin, doctors, nurses only)
 */
router.get(
  "/",
  authMiddleware,
  hasPermission("VIEW_PATIENT_LIST"),
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
          p.date_of_birth,
          p.gender,
          p.blood_type,
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
  },
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
          p.date_of_birth,
          p.gender,
          p.blood_type,
          w.id as ward_id,
          w.name as ward_name,
          u.created_at
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE p.id = $1
        `,
        [patientId],
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
        [patientId],
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
        [patientId],
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
  },
);

/**
 * GET my profile
 * Get current patient's own profile
 */
router.get("/my-profile/details", authMiddleware, async (req, res) => {
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
          p.date_of_birth,
          p.gender,
          p.blood_type,
          w.id as ward_id,
          w.name as ward_name,
          u.created_at
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE p.user_id = $1
        `,
      [userId],
    );

    if (result.rowCount === 0) {
      await pool.query(
        `
          INSERT INTO patients (user_id)
          VALUES ($1)
          ON CONFLICT (user_id) DO NOTHING
          `,
        [userId],
      );

      const retry = await pool.query(
        `
          SELECT 
            p.id,
            u.id as user_id,
            u.name,
            u.email,
            p.date_of_birth,
            p.gender,
            p.blood_type,
            w.id as ward_id,
            w.name as ward_name,
            u.created_at
          FROM patients p
          JOIN users u ON p.user_id = u.id
          LEFT JOIN wards w ON p.ward_id = w.id
          WHERE p.user_id = $1
          `,
        [userId],
      );

      if (retry.rowCount === 0) {
        return res.status(404).json({ message: "Patient profile not found" });
      }

      return res.json({
        message: "Profile retrieved successfully",
        patient: retry.rows[0],
      });
    }

    res.json({
      message: "Profile retrieved successfully",
      patient: result.rows[0],
    });
  } catch (err) {
    console.error("GET MY PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH my profile
 * Update current patient's own profile fields
 */
router.patch("/my-profile/details", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const { name, email, date_of_birth, gender, blood_type } = req.body;

  if (role !== "patient") {
    return res.status(403).json({
      message: "Only patients can update their profile",
    });
  }

  if (
    name === undefined &&
    email === undefined &&
    date_of_birth === undefined &&
    gender === undefined &&
    blood_type === undefined
  ) {
    return res.status(400).json({
      message: "At least one field is required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO patients (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        `,
      [userId],
    );

    const currentProfile = await client.query(
      `
        SELECT 
          u.id as user_id,
          u.name,
          u.email,
          p.date_of_birth,
          p.gender,
          p.blood_type
        FROM users u
        JOIN patients p ON p.user_id = u.id
        WHERE u.id = $1
        `,
      [userId],
    );

    if (currentProfile.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Patient profile not found" });
    }

    const current = currentProfile.rows[0];

    const nextName = name !== undefined ? String(name).trim() : current.name;
    const nextEmail =
      email !== undefined ? String(email).trim().toLowerCase() : current.email;
    const nextDob =
      date_of_birth !== undefined
        ? date_of_birth === "" || date_of_birth === null
          ? null
          : date_of_birth
        : current.date_of_birth;
    const nextGender =
      gender !== undefined
        ? gender === "" || gender === null
          ? null
          : String(gender).trim().toLowerCase()
        : current.gender;
    const nextBloodType =
      blood_type !== undefined
        ? blood_type === "" || blood_type === null
          ? null
          : String(blood_type).trim().toUpperCase()
        : current.blood_type;

    if (!nextName || nextName.length < 2) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Name must be at least 2 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(nextEmail)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (nextGender && !["male", "female", "other"].includes(nextGender)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Gender must be male, female, or other",
      });
    }

    if (
      nextBloodType &&
      !["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(
        nextBloodType,
      )
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Invalid blood type",
      });
    }

    if (nextEmail !== current.email) {
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE email = $1 AND id <> $2",
        [nextEmail, userId],
      );

      if (emailCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    await client.query(
      `
        UPDATE users
        SET name = $1, email = $2
        WHERE id = $3
        `,
      [nextName, nextEmail, userId],
    );

    await client.query(
      `
        UPDATE patients
        SET date_of_birth = $1, gender = $2, blood_type = $3
        WHERE user_id = $4
        `,
      [nextDob, nextGender, nextBloodType, userId],
    );

    const updated = await client.query(
      `
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          p.date_of_birth,
          p.gender,
          p.blood_type,
          w.id as ward_id,
          w.name as ward_name,
          u.created_at
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE p.user_id = $1
        `,
      [userId],
    );

    await client.query("COMMIT");

    await auditLog({
      req,
      action: "UPDATE_MY_PROFILE",
      patientId: userId,
    });

    return res.json({
      message: "Profile updated successfully",
      patient: updated.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPDATE MY PROFILE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

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
        JOIN patients pat ON pr.patient_id = pat.id
        JOIN users u ON pat.user_id = u.id
        LEFT JOIN users creator ON pr.created_by = creator.id
        LEFT JOIN patient_records original ON pr.corrected_record_id = original.id
        WHERE 1=1
      `;
      const values = [];
      let paramCount = 0;

      if (role === "patient") {
        // Ensure patient profile exists
        await pool.query(
          `INSERT INTO patients (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
          [userId],
        );

        const patientResult = await pool.query(
          `SELECT id FROM patients WHERE user_id = $1`,
          [userId],
        );

        query += ` AND pr.patient_id = $${++paramCount} AND pr.record_type = 'patient_note'`;
        values.push(patientResult.rows[0].id);
      } else if (role === "nurse") {
        query += `
          AND (
            pr.patient_id IN (
              SELECT pa.patient_id
              FROM patient_assignments pa
              WHERE pa.staff_id = $${++paramCount} AND pa.role = 'nurse'
            )
            OR pr.patient_id IN (
              SELECT p.id
              FROM patients p
              JOIN nurse_wards nw ON nw.ward_id = p.ward_id
              WHERE nw.nurse_id = $${++paramCount}
            )
          )
          AND pr.record_type IN ('nursing_note', 'patient_note')
        `;
        values.push(userId, userId);
      } else if (role === "caregiver") {
        query += `
          AND pr.patient_id IN (
            SELECT pc.patient_id
            FROM patient_caregivers pc
            WHERE pc.caregiver_id = $${++paramCount}
          )
          AND pr.record_type IN ('nursing_note', 'patient_note')
        `;
        values.push(userId);
      } else if (role === "doctor") {
        query += `
          AND (
            pr.patient_id IN (
              SELECT p.id
              FROM patients p
              JOIN doctor_wards dw ON dw.ward_id = p.ward_id
              JOIN doctors d ON d.id = dw.doctor_id
              WHERE d.user_id = $${++paramCount}
            )
            OR pr.patient_id IN (
              SELECT pa.patient_id
              FROM patient_assignments pa
              WHERE pa.staff_id = $${++paramCount} AND pa.role = 'doctor'
            )
          )
        `;
        values.push(userId, userId);
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
  },
);

/**
 * PATCH update patient
 * Update patient information (admin only)
 */
router.patch(
  "/:patientId",
  authMiddleware,
  hasPermission("MANAGE_PATIENT_PROFILE"),
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

      const check = await pool.query(`SELECT id FROM patients WHERE id = $1`, [
        patientId,
      ]);

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      if (ward_id !== undefined) {
        await pool.query(`UPDATE patients SET ward_id = $1 WHERE id = $2`, [
          ward_id,
          patientId,
        ]);
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
        [patientId],
      );

      res.json({
        message: "Patient updated successfully",
        patient: result.rows[0],
      });
    } catch (err) {
      console.error("UPDATE PATIENT ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
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
        [patientId],
      );

      if (patientCheck.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      let query = `
        SELECT 
          pr.*,
          u.name as patient_name,
          u.email as patient_email,
          creator.name as creator_name,
          creator.email as creator_email,
          CASE WHEN pr.record_type = 'void' THEN true ELSE false END as is_void
        FROM patient_records pr
        JOIN patients pat ON pr.patient_id = pat.id
        JOIN users u ON pat.user_id = u.id
        LEFT JOIN users creator ON pr.created_by = creator.id
        WHERE pr.patient_id = $1
      `;
      const values = [patientId];

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
  },
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
        [recordId],
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
        [original.patient_id, createdBy, record_type, content, original.id],
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
  },
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
        [recordId],
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
        ],
      );

      await auditLog({
        req,
        action: "VOID_PATIENT_RECORD",
        patientId: check.rows[0].patient_id,
      });

      res.json({
        message:
          "Record voided successfully (original record preserved for audit)",
      });
    } catch (err) {
      console.error("VOID RECORD ERROR:", err);
      res.status(500).json({ message: "Server error: " + err.message });
    }
  },
);

module.exports = router;
