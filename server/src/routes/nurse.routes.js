const express = require("express");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");
const {
  createNotificationsForUsers,
} = require("../services/notification.service");

const router = express.Router();

const listUserIdsForRole = async (roleName) => {
  const result = await pool.query(
    `SELECT ur.user_id as id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = $1`,
    [roleName]
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
    console.error("NURSE NOTIFICATION ERROR:", err.message);
  }
};

const ensureNurseScope = (req, res, next) => {
  const requestedNurseId = parseInt(req.params.id, 10);

  if (Number.isNaN(requestedNurseId)) {
    return res.status(400).json({ message: "Invalid nurse id" });
  }

  if (req.user.role === "admin") {
    return next();
  }

  if (req.user.role !== "nurse" || req.user.id !== requestedNurseId) {
    return res.status(403).json({
      message: "Not authorized to access this nurse data",
    });
  }

  return next();
};

router.get(
  "/",
  authMiddleware,
  hasPermission("VIEW_NURSE"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT DISTINCT
          u.id as user_id,
          u.name,
          u.email,
          u.created_at,
          COALESCE(u.active, true) as active,
          COUNT(DISTINCT nw.ward_id) as ward_count
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        LEFT JOIN nurse_wards nw ON u.id = nw.nurse_id
        WHERE r.name = 'nurse'
        GROUP BY u.id, u.name, u.email, u.created_at, u.active
        ORDER BY COALESCE(u.active, true) DESC, u.name ASC
        `
      );

      res.json({
        message: "Nurses retrieved successfully",
        nurses: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET NURSES ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/:id",
  authMiddleware,
  hasPermission("VIEW_NURSE"),
  ensureNurseScope,
  async (req, res) => {
    try {
      const nurseId = req.params.id;

      const nurseCheck = await pool.query(
        `
        SELECT u.id, u.name, u.email, u.created_at, COALESCE(u.active, true) as active
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1 AND r.name = 'nurse'
        `,
        [nurseId]
      );

      if (nurseCheck.rowCount === 0) {
        return res.status(404).json({ message: "Nurse not found" });
      }

      const nurse = nurseCheck.rows[0];

      const wardsResult = await pool.query(
        `SELECT w.id, w.name FROM wards w JOIN nurse_wards nw ON w.id = nw.ward_id WHERE nw.nurse_id = $1`,
        [nurseId]
      );

      const patientsResult = await pool.query(
        `
        SELECT DISTINCT p.id, u.id as user_id, u.name, u.email,
               w.id as ward_id, w.name as ward_name
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        JOIN patient_assignments pa ON p.user_id = pa.patient_id
        WHERE pa.staff_id = $1 AND pa.role = 'nurse'
        ORDER BY u.name ASC
        `,
        [nurseId]
      );

      res.json({
        message: "Nurse retrieved successfully",
        nurse: {
          ...nurse,
          wards: wardsResult.rows,
          assigned_patients: patientsResult.rows,
          stats: {
            ward_count: wardsResult.rowCount,
            patient_count: patientsResult.rowCount,
          },
        },
      });
    } catch (err) {
      console.error("GET NURSE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/",
  authMiddleware,
  hasPermission("MANAGE_NURSE"),
  async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email and password are required" });
    }

    try {
      await pool.query("BEGIN");

      const dup = await pool.query(`SELECT id FROM users WHERE email = $1`, [
        email,
      ]);
      if (dup.rowCount > 0) {
        await pool.query("ROLLBACK");
        return res.status(409).json({ message: "Email already in use" });
      }

      const hashedPw = await bcrypt.hash(password, 10);
      const userResult = await pool.query(
        `INSERT INTO users (name, email, password, active) VALUES ($1, $2, $3, true) RETURNING id, name, email, created_at, active`,
        [name, email, hashedPw]
      );
      const newUser = userResult.rows[0];

      const roleResult = await pool.query(
        `SELECT id FROM roles WHERE name = 'nurse'`
      );
      if (roleResult.rowCount === 0) {
        await pool.query("ROLLBACK");
        return res
          .status(500)
          .json({ message: "Nurse role not found in system" });
      }
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [newUser.id, roleResult.rows[0].id]
      );

      await pool.query("COMMIT");

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id], {
          type: "NURSE_CREATED",
          title: "Nurse Created",
          message: `Nurse "${newUser.name}" was created`,
          metadata: { nurse_user_id: newUser.id, nurse_name: newUser.name },
        });
      } catch (_) {}

      return res
        .status(201)
        .json({ message: "Nurse created successfully", nurse: newUser });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("CREATE NURSE ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.patch(
  "/:id",
  authMiddleware,
  hasPermission("MANAGE_NURSE"),
  async (req, res) => {
    const nurseId = parseInt(req.params.id, 10);
    if (Number.isNaN(nurseId)) {
      return res.status(400).json({ message: "Invalid nurse id" });
    }

    const { name, email } = req.body;
    if (!name && !email) {
      return res.status(400).json({ message: "name or email is required" });
    }

    try {
      const nurseCheck = await pool.query(
        `SELECT u.id, u.name, u.email FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = $1 AND r.name = 'nurse'`,
        [nurseId]
      );
      if (nurseCheck.rowCount === 0) {
        return res.status(404).json({ message: "Nurse not found" });
      }

      if (email && email !== nurseCheck.rows[0].email) {
        const dup = await pool.query(
          `SELECT id FROM users WHERE email = $1 AND id != $2`,
          [email, nurseId]
        );
        if (dup.rowCount > 0) {
          return res.status(409).json({ message: "Email already in use" });
        }
      }

      const sets = [];
      const vals = [];
      let idx = 1;
      if (name) {
        sets.push(`name = $${idx++}`);
        vals.push(name);
      }
      if (email) {
        sets.push(`email = $${idx++}`);
        vals.push(email);
      }
      vals.push(nurseId);

      const result = await pool.query(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, name, email, created_at, COALESCE(active, true) as active`,
        vals
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id, nurseId], {
          type: "NURSE_UPDATED",
          title: "Nurse Updated",
          message: `Nurse "${result.rows[0].name}" was updated`,
          metadata: { nurse_user_id: nurseId },
        });
      } catch (_) {}

      return res.json({
        message: "Nurse updated successfully",
        nurse: result.rows[0],
      });
    } catch (err) {
      console.error("UPDATE NURSE ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/:id",
  authMiddleware,
  hasPermission("MANAGE_NURSE"),
  async (req, res) => {
    const nurseId = parseInt(req.params.id, 10);
    if (Number.isNaN(nurseId)) {
      return res.status(400).json({ message: "Invalid nurse id" });
    }

    try {
      await pool.query("BEGIN");

      const nurseCheck = await pool.query(
        `SELECT u.id, u.name, COALESCE(u.active, true) as active
         FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id
         WHERE u.id = $1 AND r.name = 'nurse'`,
        [nurseId]
      );

      if (nurseCheck.rowCount === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ message: "Nurse not found" });
      }

      if (nurseCheck.rows[0].active === false) {
        await pool.query("ROLLBACK");
        return res.status(409).json({ message: "Nurse is already suspended" });
      }

      const removeWards = await pool.query(
        `DELETE FROM nurse_wards WHERE nurse_id = $1`,
        [nurseId]
      );

      const removeAssignments = await pool.query(
        `DELETE FROM patient_assignments WHERE staff_id = $1 AND role = 'nurse'`,
        [nurseId]
      );

      await pool.query(`UPDATE users SET active = false WHERE id = $1`, [
        nurseId,
      ]);

      await pool.query("COMMIT");

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        const nurseName = nurseCheck.rows[0].name;
        await notifyUsersBestEffort([...adminUserIds, req.user.id], {
          type: "NURSE_SUSPENDED",
          title: "Nurse Suspended",
          message: `Nurse "${nurseName}" was suspended`,
          metadata: {
            nurse_user_id: nurseId,
            nurse_name: nurseName,
            removed_ward_links: removeWards.rowCount,
            removed_patient_assignments: removeAssignments.rowCount,
          },
        });
      } catch (_) {}

      return res.json({
        message: "Nurse suspended successfully",
        nurse_id: nurseId,
        removed_ward_links: removeWards.rowCount,
        removed_patient_assignments: removeAssignments.rowCount,
      });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("SUSPEND NURSE ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.patch(
  "/:id/restore",
  authMiddleware,
  hasPermission("MANAGE_NURSE"),
  async (req, res) => {
    const nurseId = parseInt(req.params.id, 10);
    if (Number.isNaN(nurseId)) {
      return res.status(400).json({ message: "Invalid nurse id" });
    }

    try {
      const nurseCheck = await pool.query(
        `SELECT u.id, u.name, COALESCE(u.active, true) as active
         FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id
         WHERE u.id = $1 AND r.name = 'nurse'`,
        [nurseId]
      );

      if (nurseCheck.rowCount === 0) {
        return res.status(404).json({ message: "Nurse not found" });
      }

      if (nurseCheck.rows[0].active === true) {
        return res.status(409).json({ message: "Nurse is already active" });
      }

      const result = await pool.query(
        `UPDATE users SET active = true WHERE id = $1 RETURNING id, name, email, created_at, active`,
        [nurseId]
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id, nurseId], {
          type: "NURSE_RESTORED",
          title: "Nurse Restored",
          message: `Nurse "${result.rows[0].name}" was restored`,
          metadata: { nurse_user_id: nurseId, nurse_name: result.rows[0].name },
        });
      } catch (_) {}

      return res.json({
        message: "Nurse restored successfully",
        nurse: result.rows[0],
      });
    } catch (err) {
      console.error("RESTORE NURSE ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/:id/patients",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  ensureNurseScope,
  async (req, res) => {
    try {
      const nurseId = req.params.id;

      const result = await pool.query(
        `
        SELECT DISTINCT p.id, u.id as user_id, u.name, u.email,
               w.id as ward_id, w.name as ward_name
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        JOIN patient_assignments pa ON p.user_id = pa.patient_id
        WHERE pa.staff_id = $1 AND pa.role = 'nurse'
        ORDER BY u.name ASC
        `,
        [nurseId]
      );

      res.json({
        message: "Nurse patients retrieved successfully",
        patients: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET NURSE PATIENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/:id/wards",
  authMiddleware,
  hasPermission("VIEW_WARD"),
  ensureNurseScope,
  async (req, res) => {
    try {
      const nurseId = req.params.id;

      const result = await pool.query(
        `SELECT w.id, w.name FROM wards w JOIN nurse_wards nw ON w.id = nw.ward_id WHERE nw.nurse_id = $1 ORDER BY w.name ASC`,
        [nurseId]
      );

      res.json({
        message: "Nurse wards retrieved successfully",
        wards: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET NURSE WARDS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/:id/wards",
  authMiddleware,
  hasPermission("MANAGE_NURSE"),
  async (req, res) => {
    const nurseId = parseInt(req.params.id, 10);
    const wardId = parseInt(req.body.ward_id, 10);

    if (Number.isNaN(nurseId) || Number.isNaN(wardId)) {
      return res
        .status(400)
        .json({ message: "nurse id and ward_id are required" });
    }

    try {
      const nurseCheck = await pool.query(
        `SELECT u.id, u.name, COALESCE(u.active, true) as active
         FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id
         WHERE u.id = $1 AND r.name = 'nurse'`,
        [nurseId]
      );
      if (nurseCheck.rowCount === 0) {
        return res.status(404).json({ message: "Nurse not found" });
      }
      if (nurseCheck.rows[0].active === false) {
        return res
          .status(409)
          .json({ message: "Cannot assign a suspended nurse to a ward" });
      }

      const wardCheck = await pool.query(
        `SELECT id, name FROM wards WHERE id = $1 AND active = true`,
        [wardId]
      );
      if (wardCheck.rowCount === 0) {
        return res.status(404).json({ message: "Ward not found or inactive" });
      }

      const insertResult = await pool.query(
        `INSERT INTO nurse_wards (nurse_id, ward_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING nurse_id`,
        [nurseId, wardId]
      );

      if (insertResult.rowCount === 0) {
        return res
          .status(409)
          .json({ message: "Nurse is already assigned to this ward" });
      }

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id, nurseId], {
          type: "NURSE_WARD_ASSIGNED",
          title: "Ward Assignment",
          message: `${nurseCheck.rows[0].name} was assigned to ward "${wardCheck.rows[0].name}"`,
          metadata: {
            nurse_user_id: nurseId,
            ward_id: wardId,
            ward_name: wardCheck.rows[0].name,
          },
        });
      } catch (_) {}

      return res.status(201).json({ message: "Nurse assigned to ward" });
    } catch (err) {
      console.error("ASSIGN NURSE WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/:id/wards/:wardId",
  authMiddleware,
  hasPermission("MANAGE_NURSE"),
  async (req, res) => {
    const nurseId = parseInt(req.params.id, 10);
    const wardId = parseInt(req.params.wardId, 10);

    if (Number.isNaN(nurseId) || Number.isNaN(wardId)) {
      return res.status(400).json({ message: "Invalid nurse id or ward id" });
    }

    try {
      const result = await pool.query(
        `DELETE FROM nurse_wards WHERE nurse_id = $1 AND ward_id = $2`,
        [nurseId, wardId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Ward assignment not found" });
      }

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        const wardNameLookup = await pool.query(
          `SELECT name FROM wards WHERE id = $1`,
          [wardId]
        );
        const wardName = wardNameLookup.rows[0]?.name;
        const nurseNameLookup = await pool.query(
          `SELECT name FROM users WHERE id = $1`,
          [nurseId]
        );
        const nurseName = nurseNameLookup.rows[0]?.name;

        await notifyUsersBestEffort([...adminUserIds, req.user.id, nurseId], {
          type: "NURSE_WARD_UNASSIGNED",
          title: "Ward Assignment",
          message: `${nurseName || "A nurse"} was removed from ward "${wardName || wardId}"`,
          metadata: {
            nurse_user_id: nurseId,
            ward_id: wardId,
            ward_name: wardName,
          },
        });
      } catch (_) {}

      return res.json({ message: "Nurse removed from ward" });
    } catch (err) {
      console.error("REMOVE NURSE WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
