const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const pool = require("../config/db");

const router = express.Router();

/**
 * POST link caregiver to patient
 * Link a caregiver to a patient with relationship
 */
router.post(
  "/link",
  authMiddleware,
  async (req, res) => {
    try {
      const { patient_id, relationship } = req.body;
      const caregiverId = req.user.id;
      const role = req.user.role;

      // Verify user is a caregiver
      if (role !== "caregiver") {
        return res.status(403).json({
          message: "Only caregivers can link to patients",
        });
      }

      if (!patient_id || !relationship) {
        return res.status(400).json({
          message: "patient_id and relationship are required",
        });
      }

      // Check if patient exists
      const patientCheck = await pool.query(
        `SELECT id, user_id FROM patients WHERE id = $1`,
        [patient_id]
      );

      if (patientCheck.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const patientUserId = patientCheck.rows[0].user_id;

      // Check if link already exists
      const existing = await pool.query(
        `
        SELECT id FROM patient_caregivers
        WHERE patient_id = $1 AND caregiver_id = $2
        `,
        [patientUserId, caregiverId]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          message: "Caregiver is already linked to this patient",
        });
      }

      // Create link
      const result = await pool.query(
        `
        INSERT INTO patient_caregivers (patient_id, caregiver_id, relationship)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [patientUserId, caregiverId, relationship]
      );

      res.status(201).json({
        message: "Caregiver linked to patient successfully",
        link: result.rows[0],
      });
    } catch (err) {
      console.error("LINK CAREGIVER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET my patients
 * Get all patients linked to current caregiver
 */
router.get(
  "/my-patients",
  authMiddleware,
  async (req, res) => {
    try {
      const caregiverId = req.user.id;
      const role = req.user.role;

      if (role !== "caregiver") {
        return res.status(403).json({
          message: "Only caregivers can access this endpoint",
        });
      }

      const result = await pool.query(
        `
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          w.id as ward_id,
          w.name as ward_name,
          pc.relationship,
          pc.created_at as linked_at
        FROM patient_caregivers pc
        JOIN patients p ON pc.patient_id = p.user_id
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        WHERE pc.caregiver_id = $1
        ORDER BY u.name ASC
        `,
        [caregiverId]
      );

      res.json({
        message: "Linked patients retrieved successfully",
        patients: result.rows,
        count: result.rowCount,
      });
    } catch (err) {
      console.error("GET MY PATIENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * DELETE unlink from patient
 * Remove caregiver link from a patient
 */
router.delete(
  "/unlink/:patientId",
  authMiddleware,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const caregiverId = req.user.id;
      const role = req.user.role;

      if (role !== "caregiver") {
        return res.status(403).json({
          message: "Only caregivers can unlink from patients",
        });
      }

      const patientCheck = await pool.query(
        `SELECT user_id FROM patients WHERE id = $1`,
        [patientId]
      );

      if (patientCheck.rowCount === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const patientUserId = patientCheck.rows[0].user_id;

      // Check if link exists
      const check = await pool.query(
        `
        SELECT id FROM patient_caregivers
        WHERE patient_id = $1 AND caregiver_id = $2
        `,
        [patientUserId, caregiverId]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({
          message: "Caregiver link not found",
        });
      }

      // Delete link
      await pool.query(
        `
        DELETE FROM patient_caregivers
        WHERE patient_id = $1 AND caregiver_id = $2
        `,
        [patientUserId, caregiverId]
      );

      res.json({
        message: "Caregiver unlinked from patient successfully",
      });
    } catch (err) {
      console.error("UNLINK CAREGIVER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
