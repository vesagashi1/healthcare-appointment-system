const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const pool = require("../config/db");

const router = express.Router();

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
          COUNT(DISTINCT p.id) as patient_count,
          COUNT(DISTINCT d.id) as doctor_count,
          COUNT(DISTINCT n.id) as nurse_count
        FROM wards w
        LEFT JOIN patients p ON w.id = p.ward_id
        LEFT JOIN doctor_wards dw ON w.id = dw.ward_id
        LEFT JOIN doctors d ON dw.doctor_id = d.id
        LEFT JOIN nurse_wards nw ON w.id = nw.ward_id
        LEFT JOIN users n ON nw.nurse_id = n.id
        GROUP BY w.id, w.name
        ORDER BY w.name ASC
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

      // Get ward basic info
      const wardResult = await pool.query(
        `SELECT id, name FROM wards WHERE id = $1`,
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
          patients: patientsResult.rows,
          doctors: doctorsResult.rows,
          nurses: nursesResult.rows,
          stats: {
            patient_count: patientsResult.rowCount,
            doctor_count: doctorsResult.rowCount,
            nurse_count: nursesResult.rowCount,
          },
        },
      });
    } catch (err) {
      console.error("GET WARD ERROR:", err);
      res.status(500).json({ message: "Server error" });
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
        `SELECT id FROM wards WHERE name = $1`,
        [name]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          message: "Ward with this name already exists",
        });
      }

      const result = await pool.query(
        `INSERT INTO wards (name) VALUES ($1) RETURNING *`,
        [name]
      );

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
        `SELECT id FROM wards WHERE id = $1`,
        [wardId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Ward not found" });
      }

      // Check if name already exists (excluding current ward)
      const existing = await pool.query(
        `SELECT id FROM wards WHERE name = $1 AND id != $2`,
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

module.exports = router;
