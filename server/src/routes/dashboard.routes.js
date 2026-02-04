const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const pool = require("../config/db");

const router = express.Router();

/**
 * GET doctor dashboard stats
 * Returns statistics and recent activity for the logged-in doctor
 */
router.get("/doctor", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role !== "doctor") {
      return res.status(403).json({
        message: "Access denied. Doctor role required.",
      });
    }

    // Get doctor ID from user ID
    const doctorResult = await pool.query(
      `SELECT id FROM doctors WHERE user_id = $1`,
      [userId],
    );

    if (doctorResult.rowCount === 0) {
      return res.status(404).json({
        message: "Doctor profile not found",
      });
    }

    const doctorId = doctorResult.rows[0].id;

    // Get total patients count (from wards)
    const patientsResult = await pool.query(
      `
      SELECT COUNT(DISTINCT p.id) as total
      FROM patients p
      JOIN wards w ON p.ward_id = w.id
      JOIN doctor_wards dw ON w.id = dw.ward_id
      WHERE dw.doctor_id = $1
      `,
      [doctorId],
    );

    // Get appointments statistics
    const appointmentsResult = await pool.query(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'scheduled') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM appointments
      WHERE doctor_id = $1
      `,
      [doctorId],
    );

    // Get recent medical records created
    const recentRecordsResult = await pool.query(
      `
      SELECT COUNT(*) as total
      FROM patient_records
      WHERE created_by = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      `,
      [userId],
    );

    // Get recent activity (last 10 actions)
    const recentActivityResult = await pool.query(
      `
      SELECT 
        a.id,
        a.appointment_date,
        a.status,
        a.created_at,
        p.id as patient_id,
        u.name as patient_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE a.doctor_id = $1
      ORDER BY a.created_at DESC
      LIMIT 10
      `,
      [doctorId],
    );

    // Get today's appointments
    const todayAppointmentsResult = await pool.query(
      `
      SELECT 
        a.id,
        a.appointment_date,
        a.status,
        p.id as patient_id,
        u.name as patient_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE a.doctor_id = $1
        AND DATE(a.appointment_date) = CURRENT_DATE
      ORDER BY a.appointment_date ASC
      `,
      [doctorId],
    );

    res.json({
      message: "Dashboard data retrieved successfully",
      stats: {
        totalPatients: parseInt(patientsResult.rows[0].total),
        pendingAppointments: parseInt(appointmentsResult.rows[0].pending),
        totalAppointments: parseInt(appointmentsResult.rows[0].total),
        recentRecords: parseInt(recentRecordsResult.rows[0].total),
        appointmentBreakdown: {
          pending: parseInt(appointmentsResult.rows[0].pending),
          approved: parseInt(appointmentsResult.rows[0].approved),
          completed: parseInt(appointmentsResult.rows[0].completed),
          cancelled: parseInt(appointmentsResult.rows[0].cancelled),
        },
      },
      recentActivity: recentActivityResult.rows,
      todayAppointments: todayAppointmentsResult.rows,
    });
  } catch (err) {
    console.error("GET DOCTOR DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
