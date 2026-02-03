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
 * GET all appointments
 * List appointments with optional filters
 */
router.get(
  "/",
  authMiddleware,
  hasPermission("VIEW_APPOINTMENT"),
  async (req, res) => {
    try {
      const { patient_id, doctor_id, status, start_date, end_date } = req.query;
      const userId = req.user.id;
      const role = req.user.role;

      let query = `
        SELECT 
          a.id,
          a.appointment_date,
          a.status,
          a.created_at,
          d.id as doctor_id,
          d.specialization,
          u_doctor.name as doctor_name,
          u_doctor.email as doctor_email,
          p.id as patient_id,
          u_patient.name as patient_name,
          u_patient.email as patient_email
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u_doctor ON d.user_id = u_doctor.id
        JOIN patients p ON a.patient_id = p.id
        JOIN users u_patient ON p.user_id = u_patient.id
        WHERE 1=1
      `;

      const values = [];
      let paramCount = 0;

      // Role-based filtering
      if (role === "patient") {
        query += ` AND p.user_id = $${++paramCount}`;
        values.push(userId);
      } else if (role === "doctor") {
        query += ` AND d.user_id = $${++paramCount}`;
        values.push(userId);
      }

      // Optional filters
      if (patient_id) {
        query += ` AND p.id = $${++paramCount}`;
        values.push(patient_id);
      }

      if (doctor_id) {
        query += ` AND d.id = $${++paramCount}`;
        values.push(doctor_id);
      }

      if (status) {
        query += ` AND a.status = $${++paramCount}`;
        values.push(status);
      }

      if (start_date) {
        query += ` AND a.appointment_date >= $${++paramCount}`;
        values.push(start_date);
      }

      if (end_date) {
        query += ` AND a.appointment_date <= $${++paramCount}`;
        values.push(end_date);
      }

      query += ` ORDER BY a.appointment_date DESC`;

      const result = await pool.query(query, values);

      res.json({
        message: "Appointments retrieved successfully",
        appointments: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET APPOINTMENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET single appointment
 * Get appointment details by ID
 */
router.get(
  "/:id",
  authMiddleware,
  hasPermission("VIEW_APPOINTMENT"),
  async (req, res) => {
    try {
      const appointmentId = req.params.id;
      const userId = req.user.id;
      const role = req.user.role;

      const result = await pool.query(
        `
        SELECT 
          a.id,
          a.appointment_date,
          a.status,
          a.created_at,
          d.id as doctor_id,
          d.specialization,
          u_doctor.name as doctor_name,
          u_doctor.email as doctor_email,
          p.id as patient_id,
          u_patient.name as patient_name,
          u_patient.email as patient_email
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u_doctor ON d.user_id = u_doctor.id
        JOIN patients p ON a.patient_id = p.id
        JOIN users u_patient ON p.user_id = u_patient.id
        WHERE a.id = $1
        `,
        [appointmentId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      const appointment = result.rows[0];

      // Check access permissions
      if (role === "patient" && appointment.patient_id !== userId) {
        return res.status(403).json({
          message: "Not authorized to view this appointment",
        });
      }

      if (role === "doctor") {
        const doctorCheck = await pool.query(
          `SELECT d.user_id FROM doctors d WHERE d.id = $1`,
          [appointment.doctor_id]
        );
        if (doctorCheck.rows[0]?.user_id !== userId) {
          return res.status(403).json({
            message: "Not authorized to view this appointment",
          });
        }
      }

      res.json({
        message: "Appointment retrieved successfully",
        appointment,
      });
    } catch (err) {
      console.error("GET APPOINTMENT ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET my appointments
 * Get current user's appointments
 */
router.get(
  "/my-appointments/list",
  authMiddleware,
  hasPermission("VIEW_APPOINTMENT"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const { status } = req.query;

      let query = `
        SELECT 
          a.id,
          a.appointment_date,
          a.status,
          a.created_at,
          d.id as doctor_id,
          d.specialization,
          u_doctor.name as doctor_name,
          u_doctor.email as doctor_email,
          p.id as patient_id,
          u_patient.name as patient_name,
          u_patient.email as patient_email
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u_doctor ON d.user_id = u_doctor.id
        JOIN patients p ON a.patient_id = p.id
        JOIN users u_patient ON p.user_id = u_patient.id
        WHERE 1=1
      `;

      const values = [];
      let paramCount = 0;

      if (role === "patient") {
        query += ` AND p.user_id = $${++paramCount}`;
        values.push(userId);
      } else if (role === "doctor") {
        query += ` AND d.user_id = $${++paramCount}`;
        values.push(userId);
      }

      if (status) {
        query += ` AND a.status = $${++paramCount}`;
        values.push(status);
      }

      query += ` ORDER BY a.appointment_date DESC`;

      const result = await pool.query(query, values);

      res.json({
        message: "My appointments retrieved successfully",
        appointments: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET MY APPOINTMENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
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

/**
 * CANCEL appointment
 * Patient or doctor can cancel their appointments
 */
router.patch(
  "/:id/cancel",
  authMiddleware,
  hasPermission("CANCEL_APPOINTMENT"),
  async (req, res) => {
    try {
      const appointmentId = req.params.id;
      const userId = req.user.id;
      const role = req.user.role;

      // Check if appointment exists and user has access
      const check = await pool.query(
        `
        SELECT a.*, d.user_id as doctor_user_id, p.user_id as patient_user_id
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN patients p ON a.patient_id = p.id
        WHERE a.id = $1
        `,
        [appointmentId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      const appointment = check.rows[0];

      // Check permissions
      if (role === "patient" && appointment.patient_user_id !== userId) {
        return res.status(403).json({
          message: "You can only cancel your own appointments",
        });
      }

      if (role === "doctor" && appointment.doctor_user_id !== userId) {
        return res.status(403).json({
          message: "You can only cancel your own appointments",
        });
      }

      // Don't allow canceling completed appointments
      if (appointment.status === "completed") {
        return res.status(400).json({
          message: "Cannot cancel a completed appointment",
        });
      }

      const result = await pool.query(
        `
        UPDATE appointments
        SET status = 'cancelled'
        WHERE id = $1
        RETURNING *
        `,
        [appointmentId]
      );

      res.json({
        message: "Appointment cancelled successfully",
        appointment: result.rows[0],
      });
    } catch (err) {
      console.error("CANCEL APPOINTMENT ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
