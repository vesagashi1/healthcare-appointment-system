const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");
const { Parser } = require("json2csv");
const XLSX = require("xlsx");

const router = express.Router();

// Helper function to format data
const formatPatientData = (rows) => {
  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    blood_type: row.blood_type,
    ward_id: row.ward_id,
    ward_name: row.ward_name,
    created_at: row.created_at
  }));
};

const formatAppointmentData = (rows) => {
  return rows.map(row => ({
    id: row.id,
    appointment_date: row.appointment_date,
    status: row.status,
    patient_name: row.patient_name,
    doctor_name: row.doctor_name,
    created_at: row.created_at
  }));
};

const formatRecordData = (rows) => {
  return rows.map(row => ({
    id: row.id,
    patient_name: row.patient_name,
    record_type: row.record_type,
    content: row.content,
    created_by: row.created_by_name,
    created_at: row.created_at
  }));
};

/**
 * GET /api/export/patients
 * Export patients data in CSV, Excel, or JSON format
 */
router.get(
  "/patients",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const { format = "json" } = req.query;

      // Fetch patients data
      const result = await pool.query(`
        SELECT 
          p.id,
          u.id as user_id,
          u.name,
          u.email,
          p.date_of_birth,
          p.gender,
          p.blood_type,
          w.id as ward_id,
          w.name as ward_name,
          u.created_at
        FROM patients p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN wards w ON p.ward_id = w.id
        ORDER BY u.name ASC
      `);

      const data = formatPatientData(result.rows);

      // Return based on format
      if (format === "csv") {
        const parser = new Parser();
        const csv = parser.parse(data);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=patients.csv");
        return res.send(csv);
      }

      if (format === "excel") {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Patients");
        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=patients.xlsx");
        return res.send(excelBuffer);
      }

      // Default: JSON
      res.json({
        message: "Patients exported successfully",
        count: data.length,
        data: data
      });
    } catch (err) {
      console.error("EXPORT PATIENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET /api/export/appointments
 * Export appointments data
 */
router.get(
  "/appointments",
  authMiddleware,
  hasPermission("VIEW_APPOINTMENT"),
  async (req, res) => {
    try {
      const { format = "json" } = req.query;
      const normalizedFormat = (format || "json").toLowerCase().trim();

      console.log("Export appointments - format:", format, "normalized:", normalizedFormat);

      const result = await pool.query(`
        SELECT 
          a.id,
          a.appointment_date,
          a.status,
          u_patient.name as patient_name,
          u_doctor.name as doctor_name,
          a.created_at
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users u_patient ON p.user_id = u_patient.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u_doctor ON d.user_id = u_doctor.id
        ORDER BY a.appointment_date DESC
      `);

      const data = formatAppointmentData(result.rows);

      console.log("Data length:", data.length);

      if (normalizedFormat === "csv") {
        try {
          const parser = new Parser();
          const csv = parser.parse(data);
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("Content-Disposition", "attachment; filename=appointments.csv");
          return res.send(csv);
        } catch (err) {
          console.error("CSV parsing error:", err);
          return res.status(500).json({ message: "Error generating CSV", error: err.message });
        }
      }

      if (normalizedFormat === "excel") {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");
        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=appointments.xlsx");
        return res.send(excelBuffer);
      }

      res.json({
        message: "Appointments exported successfully",
        count: data.length,
        data: data
      });
    } catch (err) {
      console.error("EXPORT APPOINTMENTS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET /api/export/records
 * Export medical records data
 */
router.get(
  "/records",
  authMiddleware,
  hasPermission("VIEW_PATIENT_RECORD"),
  async (req, res) => {
    try {
      const { format = "json" } = req.query;

      const result = await pool.query(`
        SELECT 
          pr.id,
          u.name as patient_name,
          pr.record_type,
          pr.content,
          u_creator.name as created_by_name,
          pr.created_at
        FROM patient_records pr
        JOIN users u ON pr.patient_id = u.id
        JOIN users u_creator ON pr.created_by = u_creator.id
        ORDER BY pr.created_at DESC
      `);

      const data = formatRecordData(result.rows);

      if (format === "csv") {
        const parser = new Parser();
        const csv = parser.parse(data);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=records.csv");
        return res.send(csv);
      }

      if (format === "excel") {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=records.xlsx");
        return res.send(excelBuffer);
      }

      res.json({
        message: "Records exported successfully",
        count: data.length,
        data: data
      });
    } catch (err) {
      console.error("EXPORT RECORDS ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
