const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const pool = require("../config/db");
const { createNotificationsForUsers } = require("../services/notification.service");

const router = express.Router();

const listUserIdsForRole = async (roleName) => {
  const result = await pool.query(
    `
    SELECT ur.user_id as id
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = $1
    `,
    [roleName]
  );
  return result.rows.map((row) => row.id);
};

const uniqueTruthy = (ids) => [...new Set(ids.filter((id) => Boolean(id)))];

const notifyUsersBestEffort = async (userIds, payload) => {
  try {
    const recipients = uniqueTruthy(userIds);
    if (recipients.length === 0) return;
    await createNotificationsForUsers(recipients, payload);
  } catch (err) {
    console.error("WARD NOTIFICATION ERROR:", err.message);
  }
};

/**
 * GET all wards
 * List all wards
 */
router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT 
          w.id,
          w.name,
          w.active,
          COUNT(DISTINCT p.id) as patient_count,
          COUNT(DISTINCT d.id) as doctor_count,
          COUNT(DISTINCT n.id) as nurse_count
        FROM wards w
        LEFT JOIN patients p ON w.id = p.ward_id
        LEFT JOIN doctor_wards dw ON w.id = dw.ward_id
        LEFT JOIN doctors d ON dw.doctor_id = d.id
        LEFT JOIN nurse_wards nw ON w.id = nw.ward_id
        LEFT JOIN users n ON nw.nurse_id = n.id
        GROUP BY w.id, w.name, w.active
        ORDER BY w.active DESC, w.name ASC
        `
      );

      res.json({
        message: "Wards retrieved successfully",
        wards: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET WARDS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET ward by ID
 * Get ward details including patients, doctors, and nurses
 */
router.get(
  "/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const wardId = req.params.id;
      const role = req.user.role;

      // Get ward basic info
      const wardResult = await pool.query(
        `SELECT id, name, active FROM wards WHERE id = $1`,
        [wardId]
      );

      if (wardResult.rowCount === 0) {
        return res.status(404).json({ message: "Ward not found" });
      }

      const ward = wardResult.rows[0];

      // Get patients in ward
      const patientsResult = await pool.query(
        `
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email
        FROM patients p
        JOIN users u ON p.user_id = u.id
        WHERE p.ward_id = $1
        ORDER BY u.name ASC
        `,
        [wardId]
      );

      // Get doctors assigned to ward
      const doctorsResult = await pool.query(
        `
        SELECT 
          d.id,
          d.specialization,
          u.id as user_id,
          u.name,
          u.email
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        JOIN doctor_wards dw ON d.id = dw.doctor_id
        WHERE dw.ward_id = $1
        ORDER BY u.name ASC
        `,
        [wardId]
      );

      // Get nurses assigned to ward
      const nursesResult = await pool.query(
        `
        SELECT 
          u.id as user_id,
          u.name,
          u.email
        FROM users u
        JOIN nurse_wards nw ON u.id = nw.nurse_id
        WHERE nw.ward_id = $1
        ORDER BY u.name ASC
        `,
        [wardId]
      );

      res.json({
        message: "Ward retrieved successfully",
        ward: {
          ...ward,
          stats: {
            patient_count: patientsResult.rowCount,
            doctor_count: doctorsResult.rowCount,
            nurse_count: nursesResult.rowCount,
          },
          ...(role === "patient" || role === "caregiver"
            ? {
                patients: [],
                doctors: doctorsResult.rows.map((d) => ({
                  id: d.id,
                  specialization: d.specialization,
                  user_id: d.user_id,
                  name: d.name,
                })),
                nurses: nursesResult.rows.map((n) => ({
                  user_id: n.user_id,
                  name: n.name,
                })),
              }
            : {
                patients: patientsResult.rows,
                doctors: doctorsResult.rows,
                nurses: nursesResult.rows,
              }),
        },
      });
    } catch (err) {
      console.error("GET WARD ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PATCH restore ward (undo soft delete)
 * Marks ward active again (admin only)
 */
router.patch(
  "/:id/restore",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const wardId = parseInt(req.params.id, 10);
    if (Number.isNaN(wardId)) {
      return res.status(400).json({ message: "Invalid ward id" });
    }

    try {
      const wardResult = await pool.query(
        `SELECT id, name, active FROM wards WHERE id = $1`,
        [wardId]
      );

      if (wardResult.rowCount === 0) {
        return res.status(404).json({ message: "Ward not found" });
      }

      const ward = wardResult.rows[0];

      if (ward.active === true) {
        return res.status(409).json({ message: "Ward is already active" });
      }

      const nameConflict = await pool.query(
        `
        SELECT 1
        FROM wards
        WHERE active = true
          AND name = $1
          AND id <> $2
        `,
        [ward.name, wardId]
      );

      if (nameConflict.rowCount > 0) {
        return res.status(409).json({
          message: "Cannot restore ward because another active ward already has this name",
        });
      }

      const update = await pool.query(
        `UPDATE wards SET active = true WHERE id = $1 RETURNING id, name, active`,
        [wardId]
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id], {
          type: "WARD_RESTORED",
          title: "Ward Restored",
          message: `Ward "${update.rows[0].name}" was restored`,
          metadata: { ward_id: update.rows[0].id, ward_name: update.rows[0].name },
        });
      } catch (notificationErr) {
        console.error("RESTORE WARD NOTIFICATION ERROR:", notificationErr.message);
      }

      return res.json({
        message: "Ward restored successfully",
        ward: update.rows[0],
      });
    } catch (err) {
      console.error("RESTORE WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST create ward
 * Create a new ward (admin only)
 */
router.post(
  "/",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          message: "Ward name is required",
        });
      }

      // Check if ward already exists
      const existing = await pool.query(
        `SELECT id FROM wards WHERE name = $1 AND active = true`,
        [name]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          message: "Ward with this name already exists",
        });
      }

      const result = await pool.query(
        `INSERT INTO wards (name, active) VALUES ($1, true) RETURNING *`,
        [name]
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id], {
          type: "WARD_CREATED",
          title: "Ward Created",
          message: `Ward "${result.rows[0].name}" was created`,
          metadata: { ward_id: result.rows[0].id, ward_name: result.rows[0].name },
        });
      } catch (notificationErr) {
        console.error("CREATE WARD NOTIFICATION ERROR:", notificationErr.message);
      }

      res.status(201).json({
        message: "Ward created successfully",
        ward: result.rows[0],
      });
    } catch (err) {
      console.error("CREATE WARD ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PATCH update ward
 * Update ward information (admin only)
 */
router.patch(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const wardId = req.params.id;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          message: "Ward name is required",
        });
      }

      // Check if ward exists
      const check = await pool.query(
        `SELECT id FROM wards WHERE id = $1 AND active = true`,
        [wardId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Ward not found" });
      }

      // Check if name already exists (excluding current ward)
      const existing = await pool.query(
        `SELECT id FROM wards WHERE name = $1 AND id != $2 AND active = true`,
        [name, wardId]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          message: "Ward with this name already exists",
        });
      }

      const result = await pool.query(
        `UPDATE wards SET name = $1 WHERE id = $2 RETURNING *`,
        [name, wardId]
      );

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        await notifyUsersBestEffort([...adminUserIds, req.user.id], {
          type: "WARD_UPDATED",
          title: "Ward Updated",
          message: `Ward was renamed to "${result.rows[0].name}"`,
          metadata: { ward_id: result.rows[0].id, ward_name: result.rows[0].name },
        });
      } catch (notificationErr) {
        console.error("UPDATE WARD NOTIFICATION ERROR:", notificationErr.message);
      }

      res.json({
        message: "Ward updated successfully",
        ward: result.rows[0],
      });
    } catch (err) {
      console.error("UPDATE WARD ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * DELETE ward (soft delete)
 * Marks ward inactive and unassigns patients and staff links (admin only)
 */
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const wardId = parseInt(req.params.id, 10);
    if (Number.isNaN(wardId)) {
      return res.status(400).json({ message: "Invalid ward id" });
    }

    try {
      await pool.query("BEGIN");

      const check = await pool.query(
        `SELECT id, name, active FROM wards WHERE id = $1`,
        [wardId]
      );

      if (check.rowCount === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ message: "Ward not found" });
      }

      if (check.rows[0].active === false) {
        await pool.query("ROLLBACK");
        return res.status(409).json({ message: "Ward is already inactive" });
      }

      const unassignPatients = await pool.query(
        `UPDATE patients SET ward_id = NULL WHERE ward_id = $1`,
        [wardId]
      );

      const removeDoctors = await pool.query(
        `DELETE FROM doctor_wards WHERE ward_id = $1`,
        [wardId]
      );

      const removeNurses = await pool.query(
        `DELETE FROM nurse_wards WHERE ward_id = $1`,
        [wardId]
      );

      await pool.query(
        `UPDATE wards SET active = false WHERE id = $1`,
        [wardId]
      );

      await pool.query("COMMIT");

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        const wardName = check.rows[0]?.name;
        await notifyUsersBestEffort([...adminUserIds, req.user.id], {
          type: "WARD_DEACTIVATED",
          title: "Ward Deactivated",
          message: wardName ? `Ward "${wardName}" was deactivated` : `Ward #${wardId} was deactivated`,
          metadata: {
            ward_id: wardId,
            ward_name: wardName,
            unassigned_patients: unassignPatients.rowCount,
            removed_doctor_links: removeDoctors.rowCount,
            removed_nurse_links: removeNurses.rowCount,
          },
        });
      } catch (notificationErr) {
        console.error("DEACTIVATE WARD NOTIFICATION ERROR:", notificationErr.message);
      }

      return res.json({
        message: "Ward deactivated successfully",
        ward_id: wardId,
        unassigned_patients: unassignPatients.rowCount,
        removed_doctor_links: removeDoctors.rowCount,
        removed_nurse_links: removeNurses.rowCount,
      });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("DEACTIVATE WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST add doctor to ward (admin only)
 */
router.post(
  "/:id/doctors",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const wardId = parseInt(req.params.id, 10);
      const doctorId = parseInt(req.body.doctor_id, 10);

      if (Number.isNaN(wardId) || Number.isNaN(doctorId)) {
        return res.status(400).json({ message: "ward id and doctor_id are required" });
      }

      const wardCheck = await pool.query(
        `SELECT id FROM wards WHERE id = $1 AND active = true`,
        [wardId]
      );
      if (wardCheck.rowCount === 0) {
        return res.status(404).json({ message: "Ward not found" });
      }

      const doctorCheck = await pool.query(
        `SELECT id FROM doctors WHERE id = $1`,
        [doctorId]
      );
      if (doctorCheck.rowCount === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      const insertResult = await pool.query(
        `INSERT INTO doctor_wards (doctor_id, ward_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING doctor_id`,
        [doctorId, wardId]
      );

      if (insertResult.rowCount > 0) {
        try {
          const adminUserIds = await listUserIdsForRole("admin");
          const wardNameLookup = await pool.query(`SELECT name FROM wards WHERE id = $1`, [wardId]);
          const wardName = wardNameLookup.rows[0]?.name;
          const doctorUserLookup = await pool.query(
            `SELECT u.id as user_id, u.name FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
            [doctorId]
          );
          const doctorUserId = doctorUserLookup.rows[0]?.user_id;
          const doctorName = doctorUserLookup.rows[0]?.name;

          await notifyUsersBestEffort([...adminUserIds, req.user.id, doctorUserId], {
            type: "WARD_DOCTOR_ASSIGNED",
            title: "Ward Assignment",
            message: `${doctorName || "A doctor"} was assigned to ${wardName ? `ward "${wardName}"` : `ward #${wardId}`}`,
            metadata: { ward_id: wardId, ward_name: wardName, doctor_id: doctorId, doctor_user_id: doctorUserId },
          });
        } catch (notificationErr) {
          console.error("ASSIGN DOCTOR WARD NOTIFICATION ERROR:", notificationErr.message);
        }
      }

      return res.status(201).json({ message: "Doctor assigned to ward" });
    } catch (err) {
      console.error("ASSIGN DOCTOR TO WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * DELETE remove doctor from ward (admin only)
 */
router.delete(
  "/:id/doctors/:doctorId",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const wardId = parseInt(req.params.id, 10);
      const doctorId = parseInt(req.params.doctorId, 10);
      if (Number.isNaN(wardId) || Number.isNaN(doctorId)) {
        return res.status(400).json({ message: "Invalid ward id or doctor id" });
      }

      const result = await pool.query(
        `DELETE FROM doctor_wards WHERE ward_id = $1 AND doctor_id = $2`,
        [wardId, doctorId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Doctor assignment not found" });
      }

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        const wardNameLookup = await pool.query(`SELECT name FROM wards WHERE id = $1`, [wardId]);
        const wardName = wardNameLookup.rows[0]?.name;
        const doctorUserLookup = await pool.query(
          `SELECT u.id as user_id, u.name FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
          [doctorId]
        );
        const doctorUserId = doctorUserLookup.rows[0]?.user_id;
        const doctorName = doctorUserLookup.rows[0]?.name;

        await notifyUsersBestEffort([...adminUserIds, req.user.id, doctorUserId], {
          type: "WARD_DOCTOR_UNASSIGNED",
          title: "Ward Assignment",
          message: `${doctorName || "A doctor"} was removed from ${wardName ? `ward "${wardName}"` : `ward #${wardId}`}`,
          metadata: { ward_id: wardId, ward_name: wardName, doctor_id: doctorId, doctor_user_id: doctorUserId },
        });
      } catch (notificationErr) {
        console.error("REMOVE DOCTOR WARD NOTIFICATION ERROR:", notificationErr.message);
      }

      return res.json({ message: "Doctor removed from ward" });
    } catch (err) {
      console.error("REMOVE DOCTOR FROM WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST add nurse to ward (admin only)
 */
router.post(
  "/:id/nurses",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const wardId = parseInt(req.params.id, 10);
      const nurseId = parseInt(req.body.nurse_id, 10);

      if (Number.isNaN(wardId) || Number.isNaN(nurseId)) {
        return res.status(400).json({ message: "ward id and nurse_id are required" });
      }

      const wardCheck = await pool.query(
        `SELECT id FROM wards WHERE id = $1 AND active = true`,
        [wardId]
      );
      if (wardCheck.rowCount === 0) {
        return res.status(404).json({ message: "Ward not found" });
      }

      // Ensure the user is a nurse
      const nurseCheck = await pool.query(
        `
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = 'nurse'
        `,
        [nurseId]
      );
      if (nurseCheck.rowCount === 0) {
        return res.status(404).json({ message: "Nurse not found" });
      }

      const insertResult = await pool.query(
        `INSERT INTO nurse_wards (nurse_id, ward_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING nurse_id`,
        [nurseId, wardId]
      );

      if (insertResult.rowCount > 0) {
        try {
          const adminUserIds = await listUserIdsForRole("admin");
          const wardNameLookup = await pool.query(`SELECT name FROM wards WHERE id = $1`, [wardId]);
          const wardName = wardNameLookup.rows[0]?.name;
          const nurseNameLookup = await pool.query(`SELECT name FROM users WHERE id = $1`, [nurseId]);
          const nurseName = nurseNameLookup.rows[0]?.name;

          await notifyUsersBestEffort([...adminUserIds, req.user.id, nurseId], {
            type: "WARD_NURSE_ASSIGNED",
            title: "Ward Assignment",
            message: `${nurseName || "A nurse"} was assigned to ${wardName ? `ward "${wardName}"` : `ward #${wardId}`}`,
            metadata: { ward_id: wardId, ward_name: wardName, nurse_user_id: nurseId },
          });
        } catch (notificationErr) {
          console.error("ASSIGN NURSE WARD NOTIFICATION ERROR:", notificationErr.message);
        }
      }

      return res.status(201).json({ message: "Nurse assigned to ward" });
    } catch (err) {
      console.error("ASSIGN NURSE TO WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * DELETE remove nurse from ward (admin only)
 */
router.delete(
  "/:id/nurses/:nurseId",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const wardId = parseInt(req.params.id, 10);
      const nurseId = parseInt(req.params.nurseId, 10);
      if (Number.isNaN(wardId) || Number.isNaN(nurseId)) {
        return res.status(400).json({ message: "Invalid ward id or nurse id" });
      }

      const result = await pool.query(
        `DELETE FROM nurse_wards WHERE ward_id = $1 AND nurse_id = $2`,
        [wardId, nurseId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Nurse assignment not found" });
      }

      try {
        const adminUserIds = await listUserIdsForRole("admin");
        const wardNameLookup = await pool.query(`SELECT name FROM wards WHERE id = $1`, [wardId]);
        const wardName = wardNameLookup.rows[0]?.name;
        const nurseNameLookup = await pool.query(`SELECT name FROM users WHERE id = $1`, [nurseId]);
        const nurseName = nurseNameLookup.rows[0]?.name;

        await notifyUsersBestEffort([...adminUserIds, req.user.id, nurseId], {
          type: "WARD_NURSE_UNASSIGNED",
          title: "Ward Assignment",
          message: `${nurseName || "A nurse"} was removed from ${wardName ? `ward "${wardName}"` : `ward #${wardId}`}`,
          metadata: { ward_id: wardId, ward_name: wardName, nurse_user_id: nurseId },
        });
      } catch (notificationErr) {
        console.error("REMOVE NURSE WARD NOTIFICATION ERROR:", notificationErr.message);
      }

      return res.json({ message: "Nurse removed from ward" });
    } catch (err) {
      console.error("REMOVE NURSE FROM WARD ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
