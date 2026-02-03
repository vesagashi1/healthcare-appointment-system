const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const router = express.Router();

// All admin routes require admin role
router.use(authMiddleware, requireRole("admin"));

/**
 * GET all users
 * List all users with their roles
 */
router.get(
  "/users",
  async (req, res) => {
    try {
      const { role, name, email } = req.query;

      let query = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.created_at,
          STRING_AGG(r.name, ', ') as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE 1=1
      `;

      const values = [];
      let paramCount = 0;

      if (role) {
        query += ` AND r.name = $${++paramCount}`;
        values.push(role);
      }

      if (name) {
        query += ` AND u.name ILIKE $${++paramCount}`;
        values.push(`%${name}%`);
      }

      if (email) {
        query += ` AND u.email ILIKE $${++paramCount}`;
        values.push(`%${email}%`);
      }

      query += ` GROUP BY u.id, u.name, u.email, u.created_at ORDER BY u.created_at DESC`;

      const result = await pool.query(query, values);

      res.json({
        message: "Users retrieved successfully",
        users: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET USERS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET user by ID
 * Get user details with roles
 */
router.get(
  "/users/:id",
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Get user with roles
      const userResult = await pool.query(
        `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.created_at,
          STRING_AGG(r.name, ', ') as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id, u.name, u.email, u.created_at
        `,
        [userId]
      );

      if (userResult.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = userResult.rows[0];

      // Get role details
      const rolesResult = await pool.query(
        `
        SELECT r.id, r.name, r.description
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1
        `,
        [userId]
      );

      res.json({
        message: "User retrieved successfully",
        user: {
          ...user,
          role_details: rolesResult.rows,
        },
      });
    } catch (err) {
      console.error("GET USER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST create user
 * Create a new user and assign role
 */
router.post(
  "/users",
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({
          message: "name, email, password, and role are required",
        });
      }

      // Check if role exists
      const roleResult = await pool.query(
        "SELECT id FROM roles WHERE name = $1",
        [role]
      );

      if (roleResult.rows.length === 0) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const roleId = roleResult.rows[0].id;

      // Check if email already exists
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ message: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userResult = await pool.query(
        `
        INSERT INTO users (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, created_at
        `,
        [name, email, hashedPassword]
      );

      const userId = userResult.rows[0].id;

      // Assign role
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, roleId]
      );

      res.status(201).json({
        message: "User created successfully",
        user: {
          ...userResult.rows[0],
          role,
        },
      });
    } catch (err) {
      console.error("CREATE USER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PATCH update user
 * Update user information
 */
router.patch(
  "/users/:id",
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { name, email, role } = req.body;

      // Check if user exists
      const check = await pool.query(
        `SELECT id FROM users WHERE id = $1`,
        [userId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user fields
      const updates = [];
      const values = [];
      let paramCount = 0;

      if (name) {
        updates.push(`name = $${++paramCount}`);
        values.push(name);
      }

      if (email) {
        // Check if email already exists (excluding current user)
        const emailCheck = await pool.query(
          `SELECT id FROM users WHERE email = $1 AND id != $2`,
          [email, userId]
        );

        if (emailCheck.rowCount > 0) {
          return res.status(409).json({ message: "Email already exists" });
        }

        updates.push(`email = $${++paramCount}`);
        values.push(email);
      }

      if (updates.length > 0) {
        values.push(userId);
        await pool.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $${++paramCount}`,
          values
        );
      }

      // Update role if provided
      if (role) {
        const roleResult = await pool.query(
          "SELECT id FROM roles WHERE name = $1",
          [role]
        );

        if (roleResult.rows.length === 0) {
          return res.status(400).json({ message: "Invalid role" });
        }

        const roleId = roleResult.rows[0].id;

        // Remove existing roles
        await pool.query(
          `DELETE FROM user_roles WHERE user_id = $1`,
          [userId]
        );

        // Assign new role
        await pool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
          [userId, roleId]
        );
      }

      // Get updated user
      const result = await pool.query(
        `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.created_at,
          STRING_AGG(r.name, ', ') as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id, u.name, u.email, u.created_at
        `,
        [userId]
      );

      res.json({
        message: "User updated successfully",
        user: result.rows[0],
      });
    } catch (err) {
      console.error("UPDATE USER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * DELETE user
 * Soft delete user (or hard delete if preferred)
 */
router.delete(
  "/users/:id",
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Prevent deleting yourself
      if (parseInt(userId) === req.user.id) {
        return res.status(400).json({
          message: "Cannot delete your own account",
        });
      }

      // Check if user exists
      const check = await pool.query(
        `SELECT id FROM users WHERE id = $1`,
        [userId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user (cascade will handle related records)
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

      res.json({
        message: "User deleted successfully",
      });
    } catch (err) {
      console.error("DELETE USER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET audit logs
 * View system audit logs with filters
 */
router.get(
  "/audit-logs",
  async (req, res) => {
    try {
      const { user_id, action, start_date, end_date, limit = 100 } = req.query;

      let query = `
        SELECT 
          al.id,
          al.user_id,
          al.role,
          al.action,
          al.patient_id,
          al.ip_address,
          al.created_at,
          u.name as user_name,
          u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;

      const values = [];
      let paramCount = 0;

      if (user_id) {
        query += ` AND al.user_id = $${++paramCount}`;
        values.push(user_id);
      }

      if (action) {
        query += ` AND al.action = $${++paramCount}`;
        values.push(action);
      }

      if (start_date) {
        query += ` AND al.created_at >= $${++paramCount}`;
        values.push(start_date);
      }

      if (end_date) {
        query += ` AND al.created_at <= $${++paramCount}`;
        values.push(end_date);
      }

      query += ` ORDER BY al.created_at DESC LIMIT $${++paramCount}`;
      values.push(parseInt(limit));

      const result = await pool.query(query, values);

      res.json({
        message: "Audit logs retrieved successfully",
        logs: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET AUDIT LOGS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
