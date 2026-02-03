const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");

const router = express.Router();

/**
 * GET all doctors
 * List all doctors with optional specialization filter
 */
router.get(
  "/",
  authMiddleware,
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
          u.created_at
        FROM doctors d
        JOIN users u ON d.user_id = u.id
      `;

      const values = [];
      if (specialization) {
        query += ` WHERE d.specialization = $1`;
        values.push(specialization);
      }

      query += ` ORDER BY u.name ASC`;

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

/**
 * GET doctor by ID
 * Get doctor details including wards and appointment count
 */
router.get(
  "/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const doctorId = req.params.id;

      // Get doctor basic info
      const doctorResult = await pool.query(
        `
        SELECT 
          d.id,
          d.specialization,
          u.id as user_id,
          u.name,
          u.email,
          u.created_at
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

      // Get doctor's wards
      const wardsResult = await pool.query(
        `
        SELECT w.id, w.name
        FROM wards w
        JOIN doctor_wards dw ON w.id = dw.ward_id
        WHERE dw.doctor_id = $1
        `,
        [doctorId]
      );

      // Get appointment count
      const appointmentCountResult = await pool.query(
        `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM appointments
        WHERE doctor_id = $1
        `,
        [doctorId]
      );

      res.json({
        message: "Doctor retrieved successfully",
        doctor: {
          ...doctor,
          wards: wardsResult.rows,
          appointment_stats: appointmentCountResult.rows[0],
        },
      });
    } catch (err) {
      console.error("GET DOCTOR ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET doctor's appointments
 * Get all appointments for a specific doctor
 */
router.get(
  "/:id/appointments",
  authMiddleware,
  hasPermission("VIEW_APPOINTMENT"),
  async (req, res) => {
    try {
      const doctorId = req.params.id;
      const { status, start_date, end_date } = req.query;

      let query = `
        SELECT 
          a.id,
          a.appointment_date,
          a.status,
          a.created_at,
          p.id as patient_id,
          u_patient.name as patient_name,
          u_patient.email as patient_email
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users u_patient ON p.user_id = u_patient.id
        WHERE a.doctor_id = $1
      `;

      const values = [doctorId];
      let paramCount = 1;

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

/**
 * GET doctor's patients
 * Get all patients assigned to a doctor (through wards)
 */
router.get(
  "/:id/patients",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const doctorId = req.params.id;

      const result = await pool.query(
        `
        SELECT DISTINCT
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          w.id as ward_id,
          w.name as ward_name
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

module.exports = router;
