const express = require("express");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");
const { createNotificationsForUsers } = require("../services/notification.service");

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
    console.error("DOCTOR NOTIFICATION ERROR:", err.message);
  }
};

const ensureDoctorScope = async (req, res, next) => {
  try {
    const requestedDoctorId = parseInt(req.params.id, 10);

    if (Number.isNaN(requestedDoctorId)) {
      return res.status(400).json({ message: "Invalid doctor id" });
    }

    if (req.user.role === "admin") {
      return next();
    }

    if (req.user.role !== "doctor") {
      return res.status(403).json({
        message: "Not authorized to access this doctor's data",
      });
    }

    const doctorResult = await pool.query(
      `SELECT id FROM doctors WHERE user_id = $1`,
      [req.user.id]
    );

    if (doctorResult.rowCount === 0) {
      return res.status(403).json({ message: "Doctor profile not found" });
    }

    if (doctorResult.rows[0].id !== requestedDoctorId) {
      return res.status(403).json({
        message: "Not authorized to access this doctor's data",
      });
    }

    return next();
  } catch (err) {
    console.error("DOCTOR SCOPE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

router.get(
  "/",
  authMiddleware,
  hasPermission("VIEW_DOCTOR"),
  async (req, res) => {
    try {
      const { specialization } = req.query;

      let query = `
        SELECT
          d.id,
          d.specialization,
          u.id as user_id,
          u.name,
          u.email,
          u.created_at,
          COALESCE(u.active, true) as active,
          COUNT(DISTINCT dw.ward_id) as ward_count
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN doctor_wards dw ON d.id = dw.doctor_id
      `;

      const values = [];
      if (specialization) {
        query += ` WHERE d.specialization = $1`;
        values.push(specialization);
      }

      query += ` GROUP BY d.id, d.specialization, u.id, u.name, u.email, u.created_at, u.active`;
      query += ` ORDER BY COALESCE(u.active, true) DESC, u.name ASC`;

      const result = await pool.query(query, values);

      res.json({
        message: "Doctors retrieved successfully",
        doctors: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET DOCTORS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/:id",
  authMiddleware,
  hasPermission("VIEW_DOCTOR"),
  async (req, res) => {
    try {
      const doctorId = req.params.id;

      const doctorResult = await pool.query(
        `
        SELECT d.id, d.specialization, u.id as user_id, u.name, u.email, u.created_at,
               COALESCE(u.active, true) as active
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        WHERE d.id = $1
        `,
        [doctorId]
      );

      if (doctorResult.rowCount === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      const doctor = doctorResult.rows[0];

      const wardsResult = await pool.query(
        `SELECT w.id, w.name FROM wards w JOIN doctor_wards dw ON w.id = dw.ward_id WHERE dw.doctor_id = $1`,
        [doctorId]
      );

      const appointmentCountResult = await pool.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'requested') as requested,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM appointments
        WHERE doctor_id = $1
        `,
        [doctorId]
      );

      const patientsResult = await pool.query(
        `
        SELECT DISTINCT p.id, u.id as user_id, u.name, u.email,
               w.id as ward_id, w.name as ward_name
        FROM patients p
        JOIN users u ON p.user_id = u.id
        JOIN wards w ON p.ward_id = w.id
        JOIN doctor_wards dw ON w.id = dw.ward_id
        WHERE dw.doctor_id = $1
        ORDER BY u.name ASC
        `,
        [doctorId]
      );

      res.json({
        message: "Doctor retrieved successfully",
        doctor: {
          ...doctor,
          wards: wardsResult.rows,
          assigned_patients: patientsResult.rows,
          appointment_stats: appointmentCountResult.rows[0],
          stats: {
            ward_count: wardsResult.rowCount,
            patient_count: patientsResult.rowCount,
          },
        },
      });
    } catch (err) {
      console.error("GET DOCTOR ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  const { name, email, password, specialization } = req.body;

  if (!name || !email || !password || !specialization) {
    return res.status(400).json({ message: "name, email, password and specialization are required" });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const dup = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
      if (dup.rowCount > 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(409).json({ message: "Email already in use" });
      }

      const hashedPw = await bcrypt.hash(password, 10);
      const userResult = await client.query(
        `INSERT INTO users (name, email, password, active) VALUES ($1, $2, $3, true) RETURNING id, name, email, created_at, active`,
        [name, email, hashedPw]
      );
      const newUser = userResult.rows[0];

      const roleResult = await client.query(`SELECT id FROM roles WHERE name = 'doctor'`);
      if (roleResult.rowCount === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(500).json({ message: "Doctor role not found in system" });
      }
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [newUser.id, roleResult.rows[0].id]
      );

      const doctorResult = await client.query(
        `INSERT INTO doctors (user_id, specialization) VALUES ($1, $2) RETURNING id, specialization`,
        [newUser.id, specialization]
      );

      await client.query("COMMIT");
      client.release();

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      await notifyUsersBestEffort([...adminUserIds, req.user.id], {
        type: "DOCTOR_CREATED",
        title: "Doctor Created",
        message: `Doctor "${newUser.name}" (${specialization}) was created`,
        metadata: { doctor_id: doctorResult.rows[0].id, doctor_user_id: newUser.id, doctor_name: newUser.name },
      });
    } catch (_) {}

    return res.status(201).json({
      message: "Doctor created successfully",
      doctor: { ...newUser, id: doctorResult.rows[0].id, specialization: doctorResult.rows[0].specialization },
    });
    } catch (innerErr) {
      await client.query("ROLLBACK");
      client.release();
      throw innerErr;
    }
  } catch (err) {
    console.error("CREATE DOCTOR ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const doctorId = parseInt(req.params.id, 10);
  if (Number.isNaN(doctorId)) {
    return res.status(400).json({ message: "Invalid doctor id" });
  }

  const { name, email, specialization } = req.body;
  if (!name && !email && !specialization) {
    return res.status(400).json({ message: "name, email or specialization is required" });
  }

  try {
    const doctorCheck = await pool.query(
      `SELECT d.id, d.specialization, u.id as user_id, u.name, u.email
       FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
      [doctorId]
    );
    if (doctorCheck.rowCount === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doc = doctorCheck.rows[0];

    if (email && email !== doc.email) {
      const dup = await pool.query(`SELECT id FROM users WHERE email = $1 AND id != $2`, [email, doc.user_id]);
      if (dup.rowCount > 0) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const userSets = [];
    const userVals = [];
    let idx = 1;
    if (name) { userSets.push(`name = $${idx++}`); userVals.push(name); }
    if (email) { userSets.push(`email = $${idx++}`); userVals.push(email); }
    if (userSets.length > 0) {
      userVals.push(doc.user_id);
      await pool.query(`UPDATE users SET ${userSets.join(", ")} WHERE id = $${idx}`, userVals);
    }

    if (specialization) {
      await pool.query(`UPDATE doctors SET specialization = $1 WHERE id = $2`, [specialization, doctorId]);
    }

    const updated = await pool.query(
      `SELECT d.id, d.specialization, u.id as user_id, u.name, u.email, u.created_at, COALESCE(u.active, true) as active
       FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
      [doctorId]
    );

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      await notifyUsersBestEffort([...adminUserIds, req.user.id, doc.user_id], {
        type: "DOCTOR_UPDATED",
        title: "Doctor Updated",
        message: `Doctor "${updated.rows[0].name}" was updated`,
        metadata: { doctor_id: doctorId, doctor_user_id: doc.user_id },
      });
    } catch (_) {}

    return res.json({ message: "Doctor updated successfully", doctor: updated.rows[0] });
  } catch (err) {
    console.error("UPDATE DOCTOR ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const doctorId = parseInt(req.params.id, 10);
  if (Number.isNaN(doctorId)) {
    return res.status(400).json({ message: "Invalid doctor id" });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const doctorCheck = await client.query(
        `SELECT d.id, u.id as user_id, u.name, COALESCE(u.active, true) as active
         FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
        [doctorId]
      );

      if (doctorCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ message: "Doctor not found" });
      }

      if (doctorCheck.rows[0].active === false) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(409).json({ message: "Doctor is already suspended" });
      }

      const doc = doctorCheck.rows[0];

      const removeWards = await client.query(`DELETE FROM doctor_wards WHERE doctor_id = $1`, [doctorId]);
      const removeAssignments = await client.query(
        `DELETE FROM patient_assignments WHERE staff_id = $1 AND role = 'doctor'`,
        [doc.user_id]
      );
      const cancelAppointments = await client.query(
        `UPDATE appointments SET status = 'cancelled' WHERE doctor_id = $1 AND status IN ('requested', 'scheduled', 'approved')`,
        [doctorId]
      );

      await client.query(`UPDATE users SET active = false WHERE id = $1`, [doc.user_id]);

      await client.query("COMMIT");
      client.release();

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      await notifyUsersBestEffort([...adminUserIds, req.user.id], {
        type: "DOCTOR_SUSPENDED",
        title: "Doctor Suspended",
        message: `Doctor "${doc.name}" was suspended`,
        metadata: {
          doctor_id: doctorId,
          doctor_user_id: doc.user_id,
          doctor_name: doc.name,
          removed_ward_links: removeWards.rowCount,
          removed_patient_assignments: removeAssignments.rowCount,
          cancelled_appointments: cancelAppointments.rowCount,
        },
      });
    } catch (_) {}

    return res.json({
      message: "Doctor suspended successfully",
      doctor_id: doctorId,
      removed_ward_links: removeWards.rowCount,
      removed_patient_assignments: removeAssignments.rowCount,
      cancelled_appointments: cancelAppointments.rowCount,
    });
    } catch (innerErr) {
      await client.query("ROLLBACK");
      client.release();
      throw innerErr;
    }
  } catch (err) {
    console.error("SUSPEND DOCTOR ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/restore", authMiddleware, requireRole("admin"), async (req, res) => {
  const doctorId = parseInt(req.params.id, 10);
  if (Number.isNaN(doctorId)) {
    return res.status(400).json({ message: "Invalid doctor id" });
  }

  try {
    const doctorCheck = await pool.query(
      `SELECT d.id, u.id as user_id, u.name, COALESCE(u.active, true) as active
       FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
      [doctorId]
    );

    if (doctorCheck.rowCount === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctorCheck.rows[0].active === true) {
      return res.status(409).json({ message: "Doctor is already active" });
    }

    const doc = doctorCheck.rows[0];

    await pool.query(`UPDATE users SET active = true WHERE id = $1`, [doc.user_id]);

    const result = await pool.query(
      `SELECT d.id, d.specialization, u.id as user_id, u.name, u.email, u.created_at, u.active
       FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
      [doctorId]
    );

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      await notifyUsersBestEffort([...adminUserIds, req.user.id, doc.user_id], {
        type: "DOCTOR_RESTORED",
        title: "Doctor Restored",
        message: `Doctor "${doc.name}" was restored`,
        metadata: { doctor_id: doctorId, doctor_user_id: doc.user_id, doctor_name: doc.name },
      });
    } catch (_) {}

    return res.json({ message: "Doctor restored successfully", doctor: result.rows[0] });
  } catch (err) {
    console.error("RESTORE DOCTOR ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/:id/appointments",
  authMiddleware,
  hasPermission("VIEW_APPOINTMENT"),
  ensureDoctorScope,
  async (req, res) => {
    try {
      const doctorId = req.params.id;
      const { status, start_date, end_date } = req.query;

      let query = `
        SELECT
          a.id, a.appointment_date, a.status, a.created_at,
          p.id as patient_id, u_patient.name as patient_name, u_patient.email as patient_email
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users u_patient ON p.user_id = u_patient.id
        WHERE a.doctor_id = $1
      `;

      const values = [doctorId];
      let paramCount = 1;

      if (status) { query += ` AND a.status = $${++paramCount}`; values.push(status); }
      if (start_date) { query += ` AND a.appointment_date >= $${++paramCount}`; values.push(start_date); }
      if (end_date) { query += ` AND a.appointment_date <= $${++paramCount}`; values.push(end_date); }

      query += ` ORDER BY a.appointment_date DESC`;

      const result = await pool.query(query, values);

      res.json({
        message: "Doctor appointments retrieved successfully",
        appointments: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET DOCTOR APPOINTMENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/:id/patients",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  ensureDoctorScope,
  async (req, res) => {
    try {
      const doctorId = req.params.id;

      const result = await pool.query(
        `
        SELECT DISTINCT p.id, u.id as user_id, u.name, u.email,
               w.id as ward_id, w.name as ward_name
        FROM patients p
        JOIN users u ON p.user_id = u.id
        JOIN wards w ON p.ward_id = w.id
        JOIN doctor_wards dw ON w.id = dw.ward_id
        WHERE dw.doctor_id = $1
        ORDER BY u.name ASC
        `,
        [doctorId]
      );

      res.json({
        message: "Doctor patients retrieved successfully",
        patients: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET DOCTOR PATIENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get("/:id/wards", authMiddleware, ensureDoctorScope, async (req, res) => {
  try {
    const doctorId = req.params.id;

    const result = await pool.query(
      `SELECT w.id, w.name FROM wards w JOIN doctor_wards dw ON w.id = dw.ward_id WHERE dw.doctor_id = $1 ORDER BY w.name ASC`,
      [doctorId]
    );

    res.json({
      message: "Doctor wards retrieved successfully",
      wards: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error("GET DOCTOR WARDS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/wards", authMiddleware, requireRole("admin"), async (req, res) => {
  const doctorId = parseInt(req.params.id, 10);
  const wardId = parseInt(req.body.ward_id, 10);

  if (Number.isNaN(doctorId) || Number.isNaN(wardId)) {
    return res.status(400).json({ message: "doctor id and ward_id are required" });
  }

  try {
    const doctorCheck = await pool.query(
      `SELECT d.id, u.id as user_id, u.name, COALESCE(u.active, true) as active
       FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
      [doctorId]
    );
    if (doctorCheck.rowCount === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    if (doctorCheck.rows[0].active === false) {
      return res.status(409).json({ message: "Cannot assign a suspended doctor to a ward" });
    }

    const wardCheck = await pool.query(`SELECT id, name FROM wards WHERE id = $1 AND active = true`, [wardId]);
    if (wardCheck.rowCount === 0) {
      return res.status(404).json({ message: "Ward not found or inactive" });
    }

    const insertResult = await pool.query(
      `INSERT INTO doctor_wards (doctor_id, ward_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING doctor_id`,
      [doctorId, wardId]
    );

    if (insertResult.rowCount === 0) {
      return res.status(409).json({ message: "Doctor is already assigned to this ward" });
    }

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      await notifyUsersBestEffort([...adminUserIds, req.user.id, doctorCheck.rows[0].user_id], {
        type: "DOCTOR_WARD_ASSIGNED",
        title: "Ward Assignment",
        message: `${doctorCheck.rows[0].name} was assigned to ward "${wardCheck.rows[0].name}"`,
        metadata: { doctor_id: doctorId, doctor_user_id: doctorCheck.rows[0].user_id, ward_id: wardId, ward_name: wardCheck.rows[0].name },
      });
    } catch (_) {}

    return res.status(201).json({ message: "Doctor assigned to ward" });
  } catch (err) {
    console.error("ASSIGN DOCTOR WARD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id/wards/:wardId", authMiddleware, requireRole("admin"), async (req, res) => {
  const doctorId = parseInt(req.params.id, 10);
  const wardId = parseInt(req.params.wardId, 10);

  if (Number.isNaN(doctorId) || Number.isNaN(wardId)) {
    return res.status(400).json({ message: "Invalid doctor id or ward id" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM doctor_wards WHERE doctor_id = $1 AND ward_id = $2`,
      [doctorId, wardId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Ward assignment not found" });
    }

    try {
      const adminUserIds = await listUserIdsForRole("admin");
      const wardNameLookup = await pool.query(`SELECT name FROM wards WHERE id = $1`, [wardId]);
      const wardName = wardNameLookup.rows[0]?.name;
      const doctorLookup = await pool.query(
        `SELECT u.id as user_id, u.name FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = $1`,
        [doctorId]
      );
      const doctorUserId = doctorLookup.rows[0]?.user_id;
      const doctorName = doctorLookup.rows[0]?.name;

      await notifyUsersBestEffort([...adminUserIds, req.user.id, doctorUserId], {
        type: "DOCTOR_WARD_UNASSIGNED",
        title: "Ward Assignment",
        message: `${doctorName || "A doctor"} was removed from ward "${wardName || wardId}"`,
        metadata: { doctor_id: doctorId, doctor_user_id: doctorUserId, ward_id: wardId, ward_name: wardName },
      });
    } catch (_) {}

    return res.json({ message: "Doctor removed from ward" });
  } catch (err) {
    console.error("REMOVE DOCTOR WARD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
