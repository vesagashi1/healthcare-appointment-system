const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");

const router = express.Router();

/**
 * CREATE appointment
 * Patient books with doctor
 */
router.post(
  "/",
  authMiddleware,
  hasPermission("CREATE_APPOINTMENT"),
  async (req, res) => {
    const { doctor_id, appointment_date } = req.body;
    const patient_id = req.user.id;

    if (!doctor_id || !appointment_date) {
      return res.status(400).json({
        message: "doctor_id and appointment_date are required",
      });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO appointments (doctor_id, patient_id, appointment_date)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [doctor_id, patient_id, appointment_date]
      );

      return res.status(201).json({
        message: "Appointment created",
        appointment: result.rows[0],
      });
    } catch (err) {
      console.error("CREATE APPOINTMENT ERROR:", err);

      if (err.code === "23505") {
        return res.status(409).json({
          message: "Doctor already has an appointment at this time",
        });
      }

      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * APPROVE appointment
 * Doctor approves their own appointment
 */
router.patch(
  "/:id/approve",
  authMiddleware,
  hasPermission("APPROVE_APPOINTMENT"),
  async (req, res) => {
    const appointmentId = req.params.id;
    const userId = req.user.id;

    try {
      // ensure doctor owns this appointment
      const check = await pool.query(
        `
        SELECT a.*
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.id = $1 AND d.user_id = $2
        `,
        [appointmentId, userId]
      );

      if (check.rowCount === 0) {
        return res.status(403).json({
          message: "You are not allowed to approve this appointment",
        });
      }

      const result = await pool.query(
        `
        UPDATE appointments
        SET status = 'approved'
        WHERE id = $1
        RETURNING *
        `,
        [appointmentId]
      );

      return res.json({
        message: "Appointment approved",
        appointment: result.rows[0],
      });
    } catch (err) {
      console.error("APPROVE APPOINTMENT ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
