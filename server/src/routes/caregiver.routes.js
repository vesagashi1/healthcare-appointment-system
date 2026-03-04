const express = require("express");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");
const {
  createNotificationsForUsers,
} = require("../services/notification.service");

const router = express.Router();

/* ── helpers ── */

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
    console.error("CAREGIVER NOTIFICATION ERROR:", err.message);
  }
};

/* ──────────────────────────────────────────────
   GET /  — list all caregivers
   ────────────────────────────────────────────── */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        COALESCE(u.active, true) as active,
        COUNT(DISTINCT pc.patient_id) AS linked_patient_count
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN patient_caregivers pc ON pc.caregiver_id = u.id
      WHERE r.name = 'caregiver'
      GROUP BY u.id, u.name, u.email, u.created_at, u.active
      ORDER BY COALESCE(u.active, true) DESC, u.name ASC
      `,
    );

    res.json({
      message: "Caregivers retrieved successfully",
      caregivers: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error("GET CAREGIVERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   GET /my-patients  — self-service: linked patients
   (must be placed BEFORE /:id to avoid conflict)
   ────────────────────────────────────────────── */
router.get("/my-patients", authMiddleware, async (req, res) => {
  try {
    const caregiverId = req.user.id;
    const role = req.user.role;

    if (role !== "caregiver") {
      return res
        .status(403)
        .json({ message: "Only caregivers can access this endpoint" });
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
        pc.relationship,
        pc.created_at as linked_at
      FROM patient_caregivers pc
      JOIN patients p ON pc.patient_id = p.user_id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN wards w ON p.ward_id = w.id
      WHERE pc.caregiver_id = $1
      ORDER BY u.name ASC
      `,
      [caregiverId],
    );

    res.json({
      message: "Linked patients retrieved successfully",
      patients: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error("GET MY PATIENTS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   POST /link  — self-service: caregiver links to patient
   ────────────────────────────────────────────── */
router.post("/link", authMiddleware, async (req, res) => {
  try {
    const { patient_id, relationship } = req.body;
    const caregiverId = req.user.id;
    const role = req.user.role;

    if (role !== "caregiver") {
      return res
        .status(403)
        .json({ message: "Only caregivers can link to patients" });
    }

    if (!patient_id || !relationship) {
      return res
        .status(400)
        .json({ message: "patient_id and relationship are required" });
    }

    const patientCheck = await pool.query(
      `SELECT id, user_id FROM patients WHERE id = $1`,
      [patient_id],
    );
    if (patientCheck.rowCount === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patientUserId = patientCheck.rows[0].user_id;

    const existing = await pool.query(
      `SELECT id FROM patient_caregivers WHERE patient_id = $1 AND caregiver_id = $2`,
      [patientUserId, caregiverId],
    );
    if (existing.rowCount > 0) {
      return res
        .status(409)
        .json({ message: "Caregiver is already linked to this patient" });
    }

    const result = await pool.query(
      `INSERT INTO patient_caregivers (patient_id, caregiver_id, relationship) VALUES ($1, $2, $3) RETURNING *`,
      [patientUserId, caregiverId, relationship],
    );

    res
      .status(201)
      .json({ message: "Caregiver linked to patient successfully", link: result.rows[0] });
  } catch (err) {
    console.error("LINK CAREGIVER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   DELETE /unlink/:patientId  — self-service: unlink
   ────────────────────────────────────────────── */
router.delete("/unlink/:patientId", authMiddleware, async (req, res) => {
  try {
    const { patientId } = req.params;
    const caregiverId = req.user.id;
    const role = req.user.role;

    if (role !== "caregiver") {
      return res
        .status(403)
        .json({ message: "Only caregivers can unlink from patients" });
    }

    const patientCheck = await pool.query(
      `SELECT user_id FROM patients WHERE id = $1`,
      [patientId],
    );
    if (patientCheck.rowCount === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patientUserId = patientCheck.rows[0].user_id;

    const check = await pool.query(
      `SELECT id FROM patient_caregivers WHERE patient_id = $1 AND caregiver_id = $2`,
      [patientUserId, caregiverId],
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Caregiver link not found" });
    }

    await pool.query(
      `DELETE FROM patient_caregivers WHERE patient_id = $1 AND caregiver_id = $2`,
      [patientUserId, caregiverId],
    );

    res.json({ message: "Caregiver unlinked from patient successfully" });
  } catch (err) {
    console.error("UNLINK CAREGIVER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   GET /:id  — caregiver detail (linked patients)
   ────────────────────────────────────────────── */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const caregiverId = parseInt(req.params.id, 10);
    if (Number.isNaN(caregiverId)) {
      return res.status(400).json({ message: "Invalid caregiver id" });
    }

    // Only admin or the caregiver themselves
    if (req.user.role !== "admin" && req.user.id !== caregiverId) {
      return res
        .status(403)
        .json({ message: "Not authorized to access this caregiver data" });
    }

    const caregiverCheck = await pool.query(
      `
      SELECT u.id, u.name, u.email, u.created_at, COALESCE(u.active, true) as active
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1 AND r.name = 'caregiver'
      `,
      [caregiverId],
    );

    if (caregiverCheck.rowCount === 0) {
      return res.status(404).json({ message: "Caregiver not found" });
    }

    const caregiver = caregiverCheck.rows[0];

    const patientsResult = await pool.query(
      `
      SELECT
        p.id as patient_table_id,
        u.id as user_id,
        u.name,
        u.email,
        w.id as ward_id,
        w.name as ward_name,
        pc.relationship,
        pc.created_at as linked_at
      FROM patient_caregivers pc
      JOIN patients p ON pc.patient_id = p.user_id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN wards w ON p.ward_id = w.id
      WHERE pc.caregiver_id = $1
      ORDER BY u.name ASC
      `,
      [caregiverId],
    );

    res.json({
      message: "Caregiver retrieved successfully",
      caregiver: {
        ...caregiver,
        linked_patients: patientsResult.rows,
        stats: {
          patient_count: patientsResult.rowCount,
        },
      },
    });
  } catch (err) {
    console.error("GET CAREGIVER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   POST /  — create a new caregiver (admin only)
   ────────────────────────────────────────────── */
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "name, email and password are required" });
  }

  try {
    await pool.query("BEGIN");

    const dup = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dup.rowCount > 0) {
      await pool.query("ROLLBACK");
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (name, email, password, active) VALUES ($1, $2, $3, true) RETURNING id, name, email, created_at, active`,
      [name, email, hashedPw],
    );
    const newUser = userResult.rows[0];

    // Assign caregiver role
    const roleResult = await pool.query(
      `SELECT id FROM roles WHERE name = 'caregiver'`,
    );
    if (roleResult.rowCount === 0) {
      await pool.query("ROLLBACK");
      return res
        .status(500)
        .json({ message: "Caregiver role not found in system" });
    }
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [newUser.id, roleResult.rows[0].id],
    );

    await pool.query("COMMIT");

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      await notifyUsersBestEffort([...adminUserIds, req.user.id], {
        type: "CAREGIVER_CREATED",
        title: "Caregiver Created",
        message: `Caregiver "${newUser.name}" was created`,
        metadata: { caregiver_user_id: newUser.id, caregiver_name: newUser.name },
      });
    } catch (_) {}

    return res
      .status(201)
      .json({ message: "Caregiver created successfully", caregiver: newUser });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("CREATE CAREGIVER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   PATCH /:id  — update caregiver info (admin)
   ────────────────────────────────────────────── */
router.patch("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const caregiverId = parseInt(req.params.id, 10);
  if (Number.isNaN(caregiverId)) {
    return res.status(400).json({ message: "Invalid caregiver id" });
  }

  const { name, email } = req.body;
  if (!name && !email) {
    return res.status(400).json({ message: "name or email is required" });
  }

  try {
    const check = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = $1 AND r.name = 'caregiver'`,
      [caregiverId],
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ message: "Caregiver not found" });
    }

    if (email && email !== check.rows[0].email) {
      const dup = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [email, caregiverId],
      );
      if (dup.rowCount > 0) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const sets = [];
    const vals = [];
    let idx = 1;
    if (name) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (email) { sets.push(`email = $${idx++}`); vals.push(email); }
    vals.push(caregiverId);

    const result = await pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, name, email, created_at, COALESCE(active, true) as active`,
      vals,
    );

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      await notifyUsersBestEffort([...adminUserIds, req.user.id, caregiverId], {
        type: "CAREGIVER_UPDATED",
        title: "Caregiver Updated",
        message: `Caregiver "${result.rows[0].name}" was updated`,
        metadata: { caregiver_user_id: caregiverId },
      });
    } catch (_) {}

    return res.json({
      message: "Caregiver updated successfully",
      caregiver: result.rows[0],
    });
  } catch (err) {
    console.error("UPDATE CAREGIVER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   DELETE /:id  — suspend caregiver (soft delete)
   ────────────────────────────────────────────── */
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const caregiverId = parseInt(req.params.id, 10);
    if (Number.isNaN(caregiverId)) {
      return res.status(400).json({ message: "Invalid caregiver id" });
    }

    try {
      const check = await pool.query(
        `SELECT u.id, u.name, COALESCE(u.active, true) as active FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = $1 AND r.name = 'caregiver'`,
        [caregiverId],
      );
      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Caregiver not found" });
      }
      if (check.rows[0].active === false) {
        return res.status(400).json({ message: "Caregiver is already suspended" });
      }

      await pool.query("BEGIN");

      // Remove all patient links
      await pool.query(
        `DELETE FROM patient_caregivers WHERE caregiver_id = $1`,
        [caregiverId],
      );

      // Set inactive
      await pool.query(`UPDATE users SET active = false WHERE id = $1`, [
        caregiverId,
      ]);

      await pool.query("COMMIT");

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id], {
          type: "CAREGIVER_SUSPENDED",
          title: "Caregiver Suspended",
          message: `Caregiver "${check.rows[0].name}" was suspended`,
          metadata: { caregiver_user_id: caregiverId },
        });
      } catch (_) {}

      return res.json({ message: "Caregiver suspended successfully" });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("SUSPEND CAREGIVER ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
);

/* ──────────────────────────────────────────────
   PATCH /:id/restore  — restore suspended caregiver
   ────────────────────────────────────────────── */
router.patch(
  "/:id/restore",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const caregiverId = parseInt(req.params.id, 10);
    if (Number.isNaN(caregiverId)) {
      return res.status(400).json({ message: "Invalid caregiver id" });
    }

    try {
      const check = await pool.query(
        `SELECT u.id, u.name, COALESCE(u.active, true) as active FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = $1 AND r.name = 'caregiver'`,
        [caregiverId],
      );
      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Caregiver not found" });
      }
      if (check.rows[0].active !== false) {
        return res.status(400).json({ message: "Caregiver is not suspended" });
      }

      await pool.query(`UPDATE users SET active = true WHERE id = $1`, [
        caregiverId,
      ]);

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id, caregiverId], {
          type: "CAREGIVER_RESTORED",
          title: "Caregiver Restored",
          message: `Caregiver "${check.rows[0].name}" was restored`,
          metadata: { caregiver_user_id: caregiverId },
        });
      } catch (_) {}

      return res.json({ message: "Caregiver restored successfully" });
    } catch (err) {
      console.error("RESTORE CAREGIVER ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
);

/* ──────────────────────────────────────────────
   GET /:id/patients  — linked patients for a caregiver
   ────────────────────────────────────────────── */
router.get("/:id/patients", authMiddleware, async (req, res) => {
  const caregiverId = parseInt(req.params.id, 10);
  if (Number.isNaN(caregiverId)) {
    return res.status(400).json({ message: "Invalid caregiver id" });
  }

  if (req.user.role !== "admin" && req.user.id !== caregiverId) {
    return res
      .status(403)
      .json({ message: "Not authorized" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        p.id as patient_table_id,
        u.id as user_id,
        u.name,
        u.email,
        w.id as ward_id,
        w.name as ward_name,
        pc.relationship,
        pc.created_at as linked_at
      FROM patient_caregivers pc
      JOIN patients p ON pc.patient_id = p.user_id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN wards w ON p.ward_id = w.id
      WHERE pc.caregiver_id = $1
      ORDER BY u.name ASC
      `,
      [caregiverId],
    );

    res.json({
      message: "Linked patients retrieved successfully",
      patients: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error("GET CAREGIVER PATIENTS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ──────────────────────────────────────────────
   POST /:id/patients  — assign caregiver to patient (admin)
   ────────────────────────────────────────────── */
router.post(
  "/:id/patients",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const caregiverId = parseInt(req.params.id, 10);
    if (Number.isNaN(caregiverId)) {
      return res.status(400).json({ message: "Invalid caregiver id" });
    }

    const { patient_user_id, relationship } = req.body;
    if (!patient_user_id) {
      return res.status(400).json({ message: "patient_user_id is required" });
    }

    try {
      // Verify caregiver exists and is active
      const cgCheck = await pool.query(
        `SELECT u.id, u.name, COALESCE(u.active, true) as active FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = $1 AND r.name = 'caregiver'`,
        [caregiverId],
      );
      if (cgCheck.rowCount === 0) {
        return res.status(404).json({ message: "Caregiver not found" });
      }
      if (cgCheck.rows[0].active === false) {
        return res
          .status(400)
          .json({ message: "Cannot assign patients to a suspended caregiver" });
      }

      // Verify patient exists (patient_user_id is the users.id of the patient)
      const patientCheck = await pool.query(
        `SELECT p.id, u.id as user_id, u.name FROM patients p JOIN users u ON p.user_id = u.id WHERE u.id = $1`,
        [patient_user_id],
      );
      if (patientCheck.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Check if link already exists
      const existing = await pool.query(
        `SELECT id FROM patient_caregivers WHERE patient_id = $1 AND caregiver_id = $2`,
        [patient_user_id, caregiverId],
      );
      if (existing.rowCount > 0) {
        return res
          .status(409)
          .json({ message: "Caregiver is already assigned to this patient" });
      }

      await pool.query(
        `INSERT INTO patient_caregivers (patient_id, caregiver_id, relationship) VALUES ($1, $2, $3)`,
        [patient_user_id, caregiverId, relationship || "caregiver"],
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort(
          [...adminUserIds, req.user.id, caregiverId, patient_user_id],
          {
            type: "CAREGIVER_PATIENT_ASSIGNED",
            title: "Patient Assigned to Caregiver",
            message: `Patient "${patientCheck.rows[0].name}" was assigned to caregiver "${cgCheck.rows[0].name}"`,
            metadata: { caregiver_user_id: caregiverId, patient_user_id },
          },
        );
      } catch (_) {}

      return res
        .status(201)
        .json({ message: "Patient assigned to caregiver successfully" });
    } catch (err) {
      console.error("ASSIGN CAREGIVER PATIENT ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
);

/* ──────────────────────────────────────────────
   DELETE /:id/patients/:patientUserId  — unassign patient (admin)
   ────────────────────────────────────────────── */
router.delete(
  "/:id/patients/:patientUserId",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const caregiverId = parseInt(req.params.id, 10);
    const patientUserId = parseInt(req.params.patientUserId, 10);

    if (Number.isNaN(caregiverId) || Number.isNaN(patientUserId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    try {
      const check = await pool.query(
        `SELECT id FROM patient_caregivers WHERE patient_id = $1 AND caregiver_id = $2`,
        [patientUserId, caregiverId],
      );
      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      await pool.query(
        `DELETE FROM patient_caregivers WHERE patient_id = $1 AND caregiver_id = $2`,
        [patientUserId, caregiverId],
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id, caregiverId], {
          type: "CAREGIVER_PATIENT_UNASSIGNED",
          title: "Patient Unassigned from Caregiver",
          message: `A patient was unassigned from a caregiver`,
          metadata: { caregiver_user_id: caregiverId, patient_user_id: patientUserId },
        });
      } catch (_) {}

      return res.json({ message: "Patient unassigned from caregiver successfully" });
    } catch (err) {
      console.error("UNASSIGN CAREGIVER PATIENT ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
