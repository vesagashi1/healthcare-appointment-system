const express = require("express");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const requireRole = require("../middlewares/role.middleware");
const canAccessWardPatient = require("../middlewares/canAccessWardPatient");
const canAccessPatient = require("../middlewares/patientAccess.middleware");
const canDoctorWritePatient = require("../middlewares/canDoctorWritePatient");
const auditLog = require("../middlewares/auditLogger");
const pool = require("../config/db");
const {
  createNotificationsForUsers,
} = require("../services/notification.service");

const listUserIdsForRole = async (roleName) => {
  const result = await pool.query(
    `SELECT ur.user_id as id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = $1`,
    [roleName],
  );
  return result.rows.map((row) => row.id);
};

const uniqueTruthy = (ids) => [...new Set(ids.filter(Boolean))];

const notifyUsersBestEffort = async (userIds, payload) => {
  try {
    const recipients = uniqueTruthy(userIds);
    if (recipients.length === 0) return;
    await createNotificationsForUsers(recipients, payload);
  } catch (err) {
    console.error("PATIENT NOTIFICATION ERROR:", err.message);
  }
};

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
          u.created_at,
          COALESCE(u.active, true) as active
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
 * POST create patient
 * Create a new patient user (admin only)
 */
router.post(
  "/",
  authMiddleware,
  hasPermission("MANAGE_PATIENT_PROFILE"),
  async (req, res) => {
    const {
      name,
      email,
      password,
      date_of_birth,
      gender,
      blood_type,
      ward_id,
    } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email and password are required" });
    }

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const dup = await client.query(
          `SELECT id FROM users WHERE email = $1`,
          [email],
        );
        if (dup.rowCount > 0) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(409).json({ message: "Email already in use" });
        }

        const hashedPw = await bcrypt.hash(password, 10);
        const userResult = await client.query(
          `INSERT INTO users (name, email, password, active) VALUES ($1, $2, $3, true) RETURNING id, name, email, created_at, active`,
          [name, email, hashedPw],
        );
        const newUser = userResult.rows[0];

        const roleResult = await client.query(
          `SELECT id FROM roles WHERE name = 'patient'`,
        );
        if (roleResult.rowCount === 0) {
          await client.query("ROLLBACK");
          client.release();
          return res
            .status(500)
            .json({ message: "Patient role not found in system" });
        }
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newUser.id, roleResult.rows[0].id],
        );

        const patientResult = await client.query(
          `INSERT INTO patients (user_id, date_of_birth, gender, blood_type, ward_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, date_of_birth, gender, blood_type, ward_id`,
          [
            newUser.id,
            date_of_birth || null,
            gender || null,
            blood_type ? String(blood_type).trim().toUpperCase() : null,
            ward_id || null,
          ],
        );

        await client.query("COMMIT");
        client.release();

        try {
          const adminUserIds = await listUserIdsForRole("admin");
          await notifyUsersBestEffort([...adminUserIds, req.user.id], {
            type: "PATIENT_CREATED",
            title: "Patient Created",
            message: `Patient "${newUser.name}" was created`,
            metadata: {
              patient_id: patientResult.rows[0].id,
              patient_user_id: newUser.id,
              patient_name: newUser.name,
            },
          });
        } catch (_) {}

        return res.status(201).json({
          message: "Patient created successfully",
          patient: {
            ...newUser,
            id: patientResult.rows[0].id,
            user_id: newUser.id,
            date_of_birth: patientResult.rows[0].date_of_birth,
            gender: patientResult.rows[0].gender,
            blood_type: patientResult.rows[0].blood_type,
            ward_id: patientResult.rows[0].ward_id,
          },
        });
      } catch (innerErr) {
        await client.query("ROLLBACK");
        client.release();
        throw innerErr;
      }
    } catch (err) {
      console.error("CREATE PATIENT ERROR:", err);
      return res.status(500).json({ message: "Server error" });
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
          u.created_at,
          COALESCE(u.active, true) as active
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

      const appointmentStatsResult = await pool.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
           COUNT(*) FILTER (WHERE status = 'approved') as approved,
           COUNT(*) FILTER (WHERE status = 'completed') as completed
         FROM appointments WHERE patient_id = $1`,
        [patientId],
      );

      const recordCountResult = await pool.query(
        `SELECT COUNT(*) as count FROM patient_records WHERE patient_id = $1`,
        [patientId],
      );

      res.json({
        message: "Patient retrieved successfully",
        patient: {
          ...patient,
          assigned_staff: staffResult.rows,
          caregivers: caregiversResult.rows,
          appointment_stats: appointmentStatsResult.rows[0],
          stats: {
            staff_count: staffResult.rowCount,
            caregiver_count: caregiversResult.rowCount,
            record_count: Number(recordCountResult.rows[0].count),
          },
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
    const patientId = parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) {
      return res.status(400).json({ message: "Invalid patient id" });
    }

    const { name, email, date_of_birth, gender, blood_type, ward_id } =
      req.body;

    if (
      name === undefined &&
      email === undefined &&
      date_of_birth === undefined &&
      gender === undefined &&
      blood_type === undefined &&
      ward_id === undefined
    ) {
      return res
        .status(400)
        .json({ message: "At least one field is required" });
    }

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const check = await client.query(
          `SELECT p.id, u.id as user_id, u.name, u.email, p.date_of_birth, p.gender, p.blood_type, p.ward_id
           FROM patients p JOIN users u ON p.user_id = u.id WHERE p.id = $1`,
          [patientId],
        );

        if (check.rowCount === 0) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(404).json({ message: "Patient not found" });
        }

        const current = check.rows[0];

        // Update users table (name, email)
        if (name !== undefined || email !== undefined) {
          const nextName =
            name !== undefined ? String(name).trim() : current.name;
          const nextEmail =
            email !== undefined
              ? String(email).trim().toLowerCase()
              : current.email;

          if (nextEmail !== current.email) {
            const dup = await client.query(
              `SELECT id FROM users WHERE email = $1 AND id != $2`,
              [nextEmail, current.user_id],
            );
            if (dup.rowCount > 0) {
              await client.query("ROLLBACK");
              client.release();
              return res.status(409).json({ message: "Email already in use" });
            }
          }

          await client.query(
            `UPDATE users SET name = $1, email = $2 WHERE id = $3`,
            [nextName, nextEmail, current.user_id],
          );
        }

        // Update patients table
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
        const nextWardId =
          ward_id !== undefined ? ward_id || null : current.ward_id;

        await client.query(
          `UPDATE patients SET date_of_birth = $1, gender = $2, blood_type = $3, ward_id = $4 WHERE id = $5`,
          [nextDob, nextGender, nextBloodType, nextWardId, patientId],
        );

        await client.query("COMMIT");

        const result = await pool.query(
          `SELECT p.id, u.id as user_id, u.name, u.email, p.date_of_birth, p.gender, p.blood_type,
                  w.id as ward_id, w.name as ward_name, u.created_at, COALESCE(u.active, true) as active
           FROM patients p JOIN users u ON p.user_id = u.id LEFT JOIN wards w ON p.ward_id = w.id
           WHERE p.id = $1`,
          [patientId],
        );

        client.release();

        try {
          const adminUserIds = await listUserIdsForRole("admin");
          await notifyUsersBestEffort(
            [...adminUserIds, req.user.id, current.user_id],
            {
              type: "PATIENT_UPDATED",
              title: "Patient Updated",
              message: `Patient "${result.rows[0].name}" was updated`,
              metadata: { patient_id: patientId },
            },
          );
        } catch (_) {}

        return res.json({
          message: "Patient updated successfully",
          patient: result.rows[0],
        });
      } catch (innerErr) {
        await client.query("ROLLBACK");
        client.release();
        throw innerErr;
      }
    } catch (err) {
      console.error("UPDATE PATIENT ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/**
 * DELETE suspend patient
 * Suspend a patient (sets user.active = false, removes assignments)
 */
router.delete(
  "/:patientId",
  authMiddleware,
  hasPermission("MANAGE_PATIENT_PROFILE"),
  async (req, res) => {
    const patientId = parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) {
      return res.status(400).json({ message: "Invalid patient id" });
    }

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const check = await client.query(
          `SELECT p.id, u.id as user_id, u.name, COALESCE(u.active, true) as active
           FROM patients p JOIN users u ON p.user_id = u.id WHERE p.id = $1`,
          [patientId],
        );

        if (check.rowCount === 0) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(404).json({ message: "Patient not found" });
        }

        if (check.rows[0].active === false) {
          await client.query("ROLLBACK");
          client.release();
          return res
            .status(409)
            .json({ message: "Patient is already suspended" });
        }

        const pat = check.rows[0];

        // Remove staff assignments
        const removeAssignments = await client.query(
          `DELETE FROM patient_assignments WHERE patient_id = $1`,
          [patientId],
        );

        // Remove caregiver links
        const removeCaregivers = await client.query(
          `DELETE FROM patient_caregivers WHERE patient_id = $1`,
          [patientId],
        );

        // Cancel pending appointments
        const cancelAppointments = await client.query(
          `UPDATE appointments SET status = 'cancelled'
           WHERE patient_id = $1 AND status IN ('requested', 'scheduled', 'approved')`,
          [patientId],
        );

        // Set user inactive
        await client.query(`UPDATE users SET active = false WHERE id = $1`, [
          pat.user_id,
        ]);

        await client.query("COMMIT");
        client.release();

        try {
          const adminUserIds = await listUserIdsForRole("admin");
          await notifyUsersBestEffort([...adminUserIds, req.user.id], {
            type: "PATIENT_SUSPENDED",
            title: "Patient Suspended",
            message: `Patient "${pat.name}" was suspended`,
            metadata: {
              patient_id: patientId,
              patient_user_id: pat.user_id,
              patient_name: pat.name,
              removed_staff_assignments: removeAssignments.rowCount,
              removed_caregiver_links: removeCaregivers.rowCount,
              cancelled_appointments: cancelAppointments.rowCount,
            },
          });
        } catch (_) {}

        return res.json({
          message: "Patient suspended successfully",
          patient_id: patientId,
          removed_staff_assignments: removeAssignments.rowCount,
          removed_caregiver_links: removeCaregivers.rowCount,
          cancelled_appointments: cancelAppointments.rowCount,
        });
      } catch (innerErr) {
        await client.query("ROLLBACK");
        client.release();
        throw innerErr;
      }
    } catch (err) {
      console.error("SUSPEND PATIENT ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
);

/**
 * PATCH restore patient
 * Restore a suspended patient
 */
router.patch(
  "/:patientId/restore",
  authMiddleware,
  hasPermission("MANAGE_PATIENT_PROFILE"),
  async (req, res) => {
    const patientId = parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) {
      return res.status(400).json({ message: "Invalid patient id" });
    }

    try {
      const check = await pool.query(
        `SELECT p.id, u.id as user_id, u.name, COALESCE(u.active, true) as active
         FROM patients p JOIN users u ON p.user_id = u.id WHERE p.id = $1`,
        [patientId],
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      if (check.rows[0].active === true) {
        return res.status(409).json({ message: "Patient is already active" });
      }

      const pat = check.rows[0];

      await pool.query(`UPDATE users SET active = true WHERE id = $1`, [
        pat.user_id,
      ]);

      const result = await pool.query(
        `SELECT p.id, u.id as user_id, u.name, u.email, p.date_of_birth, p.gender, p.blood_type,
                w.id as ward_id, w.name as ward_name, u.created_at, COALESCE(u.active, true) as active
         FROM patients p JOIN users u ON p.user_id = u.id LEFT JOIN wards w ON p.ward_id = w.id
         WHERE p.id = $1`,
        [patientId],
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort(
          [...adminUserIds, req.user.id, pat.user_id],
          {
            type: "PATIENT_RESTORED",
            title: "Patient Restored",
            message: `Patient "${pat.name}" was restored`,
            metadata: { patient_id: patientId, patient_user_id: pat.user_id },
          },
        );
      } catch (_) {}

      return res.json({
        message: "Patient restored successfully",
        patient: result.rows[0],
      });
    } catch (err) {
      console.error("RESTORE PATIENT ERROR:", err);
      return res.status(500).json({ message: "Server error" });
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
