const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");

const router = express.Router();

/**
 * GET all nurses
 * List all nurses
 */
router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT DISTINCT
          u.id as user_id,
          u.name,
          u.email,
          u.created_at,
          COUNT(DISTINCT nw.ward_id) as ward_count
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        LEFT JOIN nurse_wards nw ON u.id = nw.nurse_id
        WHERE r.name = 'nurse'
        GROUP BY u.id, u.name, u.email, u.created_at
        ORDER BY u.name ASC
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

/**
 * GET nurse by ID
 * Get nurse details including wards and assigned patients
 */
router.get(
  "/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const nurseId = req.params.id;

      // Verify user is a nurse
      const nurseCheck = await pool.query(
        `
        SELECT u.id, u.name, u.email, u.created_at
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

      // Get nurse's wards
      const wardsResult = await pool.query(
        `
        SELECT w.id, w.name
        FROM wards w
        JOIN nurse_wards nw ON w.id = nw.ward_id
        WHERE nw.nurse_id = $1
        `,
        [nurseId]
      );

      // Get assigned patients (through patient_assignments)
      const patientsResult = await pool.query(
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
        LEFT JOIN wards w ON p.ward_id = w.id
        JOIN patient_assignments pa ON p.id = pa.patient_id
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

/**
 * GET nurse's patients
 * Get all patients assigned to a nurse
 */
router.get(
  "/:id/patients",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const nurseId = req.params.id;

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
        LEFT JOIN wards w ON p.ward_id = w.id
        JOIN patient_assignments pa ON p.id = pa.patient_id
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

/**
 * GET nurse's wards
 * Get all wards assigned to a nurse
 */
router.get(
  "/:id/wards",
  authMiddleware,
  async (req, res) => {
    try {
      const nurseId = req.params.id;

      const result = await pool.query(
        `
        SELECT w.id, w.name
        FROM wards w
        JOIN nurse_wards nw ON w.id = nw.ward_id
        WHERE nw.nurse_id = $1
        ORDER BY w.name ASC
        `,
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

module.exports = router;
