const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middlewares/auth.middleware");
const hasPermission = require("../middlewares/permission.middleware");
const pool = require("../config/db");

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Get file extension
    const fileExtension = file.originalname.split(".").pop().toLowerCase();
    const allowedExtensions = ["csv", "xlsx", "xls", "json"];
    
    // Check extension first (more reliable than mimetype)
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      // Also check mimetype as fallback
      const allowedTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/json",
        "text/plain" // Some systems send CSV as text/plain
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Only CSV, Excel, and JSON are allowed. Got: ${file.mimetype}`));
      }
    }
  }
});

// Helper function to parse file
const parseFile = (filePath, fileType) => {
  if (fileType === "json") {
    const fileContent = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileContent);
  }

  if (fileType === "csv") {
    // For CSV files, parse manually to avoid Excel date conversion issues
    const csvContent = fs.readFileSync(filePath, "utf8");
    const lines = csvContent.split("\n").filter(line => line.trim());
    if (lines.length === 0) throw new Error("Empty CSV file");
    
    // Parse headers
    const headers = lines[0].split(",").map(h => h.trim());
    const data = [];
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Handle CSV values that might contain commas (basic parsing)
      const values = [];
      let currentValue = "";
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add last value
      
      const row = {};
      headers.forEach((header, index) => {
        let value = values[index] || "";
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        row[header] = value;
      });
      data.push(row);
    }
    return data;
  }

  if (fileType === "excel") {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Convert Excel date numbers to date strings
    return data.map(row => {
      if (row.date_of_birth && typeof row.date_of_birth === 'number') {
        // Excel date serial number to JavaScript date
        const excelEpoch = new Date(1899, 11, 30); // Excel epoch
        const jsDate = new Date(excelEpoch.getTime() + row.date_of_birth * 86400000);
        row.date_of_birth = jsDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      }
      return row;
    });
  }

  throw new Error("Unsupported file type");
};

// Helper function to validate patient data
const validatePatientData = (row) => {
  const errors = [];
  if (!row.name) errors.push("Name is required");
  if (!row.email) errors.push("Email is required");
  // date_of_birth, gender, blood_type are optional
  return errors;
};

/**
 * POST /api/import/patients
 * Import patients from file (CSV, Excel, or JSON)
 */
router.post(
  "/patients",
  authMiddleware,
  hasPermission("CREATE_PATIENT_RECORD"),
  (req, res, next) => {
    // Handle multer errors
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("MULTER ERROR:", err);
        return res.status(400).json({ 
          message: "File upload error", 
          error: err.message,
          hint: "Make sure to select 'File' type (not 'Text') in Postman form-data, and remove any Content-Type header"
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded. Make sure to select 'File' type in Postman form-data." });
      }

      const fileExtension = req.file.originalname.split(".").pop().toLowerCase();
      const fileType = fileExtension === "xlsx" || fileExtension === "xls" ? "excel" : fileExtension;

      console.log("File upload:", {
        originalname: req.file.originalname,
        extension: fileExtension,
        fileType: fileType,
        path: req.file.path
      });

      // Parse file
      const data = parseFile(req.file.path, fileType);
      
      console.log("Parsed data sample:", data[0]);

      // Validate and import
      const results = {
        success: [],
        errors: []
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const errors = validatePatientData(row);

        if (errors.length > 0) {
          results.errors.push({
            row: i + 1,
            data: row,
            errors: errors
          });
          continue;
        }

        try {
          // Check if user already exists
          const userCheck = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [row.email]
          );

          let userId;
          if (userCheck.rowCount > 0) {
            userId = userCheck.rows[0].id;
            
            // Check if patient record already exists for this user
            const patientCheck = await pool.query(
              "SELECT id FROM patients WHERE user_id = $1",
              [userId]
            );
            
            if (patientCheck.rowCount > 0) {
              // Patient already exists, update it instead
              const wardId = row.ward_id ? parseInt(row.ward_id) : null;
              const dateOfBirth = row.date_of_birth || null;
              const gender = row.gender || null;
              const bloodType = row.blood_type || null;
              
              await pool.query(
                "UPDATE patients SET ward_id = COALESCE($1, ward_id), date_of_birth = COALESCE($2, date_of_birth), gender = COALESCE($3, gender), blood_type = COALESCE($4, blood_type) WHERE user_id = $5",
                [wardId, dateOfBirth, gender, bloodType, userId]
              );
              
              results.success.push({
                row: i + 1,
                patient_id: patientCheck.rows[0].id,
                name: row.name,
                action: "updated"
              });
              continue;
            }
          } else {
            // Hash password
            const hashedPassword = await bcrypt.hash("temp_password_123", 10);
            
            // Create user (no role column in users table)
            const userResult = await pool.query(
              "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id",
              [row.name, row.email, hashedPassword]
            );
            userId = userResult.rows[0].id;
            
            // Get patient role_id and assign it
            const roleResult = await pool.query(
              "SELECT id FROM roles WHERE name = $1",
              ["patient"]
            );
            
            if (roleResult.rowCount > 0) {
              const roleId = roleResult.rows[0].id;
              await pool.query(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [userId, roleId]
              );
            }
          }

          // Create patient record (use ON CONFLICT to handle edge cases)
          const wardId = row.ward_id ? parseInt(row.ward_id) : null;
          const dateOfBirth = row.date_of_birth || null;
          const gender = row.gender || null;
          const bloodType = row.blood_type || null;
          
          const patientResult = await pool.query(
            `INSERT INTO patients (user_id, ward_id, date_of_birth, gender, blood_type) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (user_id) 
             DO UPDATE SET 
               ward_id = COALESCE(EXCLUDED.ward_id, patients.ward_id),
               date_of_birth = COALESCE(EXCLUDED.date_of_birth, patients.date_of_birth),
               gender = COALESCE(EXCLUDED.gender, patients.gender),
               blood_type = COALESCE(EXCLUDED.blood_type, patients.blood_type)
             RETURNING id`,
            [userId, wardId, dateOfBirth, gender, bloodType]
          );

          results.success.push({
            row: i + 1,
            patient_id: patientResult.rows[0].id,
            name: row.name,
            action: "created"
          });
        } catch (err) {
          console.error(`Error importing row ${i + 1}:`, err);
          results.errors.push({
            row: i + 1,
            data: row,
            errors: [err.message]
          });
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      const responseData = {
        message: "Import completed",
        total: data.length,
        successful: results.success.length,
        failed: results.errors.length,
        results: results
      };
      
      console.log("Import response:", JSON.stringify(responseData, null, 2));
      console.log(`Success count: ${results.success.length}, Error count: ${results.errors.length}`);

      res.json(responseData);
    } catch (err) {
      console.error("IMPORT PATIENTS ERROR:", err);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Server error: " + err.message });
    }
  }
);

/**
 * POST /api/import/appointments
 * Import appointments from file
 */
router.post(
  "/appointments",
  authMiddleware,
  hasPermission("CREATE_APPOINTMENT"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileExtension = req.file.originalname.split(".").pop().toLowerCase();
      const fileType = fileExtension === "xlsx" || fileExtension === "xls" ? "excel" : fileExtension;

      const data = parseFile(req.file.path, fileType);
      const results = { success: [], errors: [] };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Validate required fields
        if (!row.patient_id || !row.doctor_id || !row.appointment_date) {
          results.errors.push({
            row: i + 1,
            data: row,
            errors: ["Missing required fields: patient_id, doctor_id, appointment_date"]
          });
          continue;
        }

        try {
          const result = await pool.query(
            "INSERT INTO appointments (patient_id, doctor_id, appointment_date, status) VALUES ($1, $2, $3, $4) RETURNING id",
            [row.patient_id, row.doctor_id, row.appointment_date, row.status || "scheduled"]
          );

          results.success.push({
            row: i + 1,
            appointment_id: result.rows[0].id
          });
        } catch (err) {
          results.errors.push({
            row: i + 1,
            data: row,
            errors: [err.message]
          });
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        message: "Import completed",
        total: data.length,
        successful: results.success.length,
        failed: results.errors.length,
        results: results
      });
    } catch (err) {
      console.error("IMPORT APPOINTMENTS ERROR:", err);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Server error: " + err.message });
    }
  }
);

/**
 * POST /api/import/records
 * Import medical records from file
 */
router.post(
  "/records",
  authMiddleware,
  hasPermission("CREATE_PATIENT_RECORD"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileExtension = req.file.originalname.split(".").pop().toLowerCase();
      const fileType = fileExtension === "xlsx" || fileExtension === "xls" ? "excel" : fileExtension;

      const data = parseFile(req.file.path, fileType);
      const results = { success: [], errors: [] };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        if (!row.patient_id || !row.record_type || !row.content) {
          results.errors.push({
            row: i + 1,
            data: row,
            errors: ["Missing required fields: patient_id, record_type, content"]
          });
          continue;
        }

        try {
          // patient_id in patient_records references users.id, not patients.id
          // So we need to get the user_id from the patient
          const patientCheck = await pool.query(
            "SELECT user_id FROM patients WHERE id = $1",
            [row.patient_id]
          );

          if (patientCheck.rowCount === 0) {
            results.errors.push({
              row: i + 1,
              data: row,
              errors: ["Patient not found"]
            });
            continue;
          }

          const patientUserId = patientCheck.rows[0].user_id;
          const createdBy = req.user.id;

          const result = await pool.query(
            "INSERT INTO patient_records (patient_id, created_by, record_type, content) VALUES ($1, $2, $3, $4) RETURNING id",
            [patientUserId, createdBy, row.record_type, row.content]
          );

          results.success.push({
            row: i + 1,
            record_id: result.rows[0].id
          });
        } catch (err) {
          results.errors.push({
            row: i + 1,
            data: row,
            errors: [err.message]
          });
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        message: "Import completed",
        total: data.length,
        successful: results.success.length,
        failed: results.errors.length,
        results: results
      });
    } catch (err) {
      console.error("IMPORT RECORDS ERROR:", err);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Server error: " + err.message });
    }
  }
);

module.exports = router;
