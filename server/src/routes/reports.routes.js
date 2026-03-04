const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const pool = require("../config/db");
const { Parser } = require("json2csv");
const XLSX = require("xlsx");

const router = express.Router();

const normalizeExportFormat = (value) => {
  const format = String(value || "json").toLowerCase().trim();
  if (format === "xlsx" || format === "xls" || format === "excel") {
    return "excel";
  }
  if (format === "csv") {
    return "csv";
  }
  return "json";
};

const isReportRoleAllowed = (role) => ["admin", "doctor", "nurse"].includes(role);

const buildScopeClause = (role, userId, wardField, values) => {
  if (role === "doctor") {
    return ` AND EXISTS (
      SELECT 1
      FROM doctors d
      JOIN doctor_wards dw ON dw.doctor_id = d.id
      WHERE d.user_id = $${values.push(userId)}
        AND dw.ward_id = ${wardField}
    )`;
  }

  if (role === "nurse") {
    return ` AND EXISTS (
      SELECT 1
      FROM nurse_wards nw
      WHERE nw.nurse_id = $${values.push(userId)}
        AND nw.ward_id = ${wardField}
    )`;
  }

  return "";
};

const buildCommonFilters = (req, values, options = {}) => {
  const { start_date, end_date, ward_id, status, role } = req.query;
  const fieldMap = {
    date: options.dateField,
    ward: options.wardField,
    status: options.statusField,
    role: options.roleField,
  };

  let where = "WHERE 1=1";

  if (start_date && fieldMap.date) {
    where += ` AND ${fieldMap.date} >= $${values.push(start_date)}`;
  }
  if (end_date && fieldMap.date) {
    where += ` AND ${fieldMap.date} <= $${values.push(end_date)}`;
  }
  if (ward_id && fieldMap.ward) {
    where += ` AND ${fieldMap.ward} = $${values.push(ward_id)}`;
  }
  if (status && fieldMap.status) {
    where += ` AND ${fieldMap.status} = $${values.push(status)}`;
  }
  if (role && fieldMap.role) {
    where += ` AND ${fieldMap.role} = $${values.push(role)}`;
  }

  return where;
};

const getReportData = async (req) => {
  const role = req.user.role;
  const userId = req.user.id;

  if (!isReportRoleAllowed(role)) {
    const err = new Error("Not authorized to access reports");
    err.status = 403;
    throw err;
  }

  const appointmentValues = [];
  let appointmentWhere = buildCommonFilters(req, appointmentValues, {
    dateField: "a.appointment_date",
    wardField: "p.ward_id",
    statusField: "a.status",
  });
  appointmentWhere += buildScopeClause(role, userId, "p.ward_id", appointmentValues);

  const appointmentStatusResult = await pool.query(
    `
    SELECT a.status, COUNT(*)::int as count
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    ${appointmentWhere}
    GROUP BY a.status
    ORDER BY a.status ASC
    `,
    appointmentValues
  );

  const overviewResult = await pool.query(
    `
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE a.status = 'requested')::int as requested,
      COUNT(*) FILTER (WHERE a.status = 'scheduled')::int as scheduled,
      COUNT(*) FILTER (WHERE a.status = 'cancelled')::int as cancelled,
      COUNT(*) FILTER (WHERE a.status = 'completed')::int as completed
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    ${appointmentWhere}
    `,
    appointmentValues
  );

  const wardValues = [];
  let wardWhere = buildCommonFilters(req, wardValues, {
    wardField: "w.id",
  });
  wardWhere += buildScopeClause(role, userId, "w.id", wardValues);

  const wardBreakdownResult = await pool.query(
    `
    SELECT
      w.id as ward_id,
      w.name as ward_name,
      COUNT(DISTINCT p.id)::int as patient_count,
      COUNT(DISTINCT a.id)::int as appointment_count
    FROM wards w
    LEFT JOIN patients p ON p.ward_id = w.id
    LEFT JOIN appointments a ON a.patient_id = p.id
    ${wardWhere}
    GROUP BY w.id, w.name
    ORDER BY w.name ASC
    `,
    wardValues
  );

  const recordValues = [];
  let recordWhere = buildCommonFilters(req, recordValues, {
    dateField: "pr.created_at",
    wardField: "p.ward_id",
  });
  recordWhere += buildScopeClause(role, userId, "p.ward_id", recordValues);

  const recordTypesResult = await pool.query(
    `
    SELECT pr.record_type, COUNT(*)::int as count
    FROM patient_records pr
    LEFT JOIN patients p ON p.user_id = pr.patient_id
    ${recordWhere}
    GROUP BY pr.record_type
    ORDER BY count DESC
    `,
    recordValues
  );

  const userRoleValues = [];
  let userRoleWhere = buildCommonFilters(req, userRoleValues, {
    roleField: "r.name",
  });

  if (role !== "admin") {
    userRoleWhere += ` AND r.name = $${userRoleValues.push(role)}`;
  }

  const userRolesResult = await pool.query(
    `
    SELECT r.name as role, COUNT(DISTINCT u.id)::int as count
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    ${userRoleWhere}
    GROUP BY r.name
    ORDER BY r.name ASC
    `,
    userRoleValues
  );

  const overview = overviewResult.rows[0] || {
    total: 0,
    requested: 0,
    scheduled: 0,
    cancelled: 0,
    completed: 0,
  };

  return {
    generated_at: new Date().toISOString(),
    filters: {
      start_date: req.query.start_date || null,
      end_date: req.query.end_date || null,
      ward_id: req.query.ward_id || null,
      role: req.query.role || null,
      status: req.query.status || null,
    },
    overview,
    appointment_status: appointmentStatusResult.rows,
    wards: wardBreakdownResult.rows,
    record_types: recordTypesResult.rows,
    user_roles: userRolesResult.rows,
  };
};

const sendExport = (res, format, report) => {
  if (format === "csv") {
    const rows = [
      { section: "overview", metric: "total_appointments", value: report.overview.total },
      { section: "overview", metric: "requested", value: report.overview.requested },
      { section: "overview", metric: "scheduled", value: report.overview.scheduled },
      { section: "overview", metric: "cancelled", value: report.overview.cancelled },
      { section: "overview", metric: "completed", value: report.overview.completed },
      ...report.appointment_status.map((row) => ({
        section: "appointment_status",
        metric: row.status,
        value: row.count,
      })),
      ...report.wards.map((row) => ({
        section: "ward_breakdown",
        metric: row.ward_name,
        value: row.appointment_count,
      })),
      ...report.record_types.map((row) => ({
        section: "record_types",
        metric: row.record_type,
        value: row.count,
      })),
      ...report.user_roles.map((row) => ({
        section: "user_roles",
        metric: row.role,
        value: row.count,
      })),
    ];

    const parser = new Parser({ fields: ["section", "metric", "value"] });
    const csv = parser.parse(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=reports.csv");
    return res.send(csv);
  }

  if (format === "excel") {
    const workbook = XLSX.utils.book_new();

    const overviewSheet = XLSX.utils.json_to_sheet([
      { metric: "total_appointments", value: report.overview.total },
      { metric: "requested", value: report.overview.requested },
      { metric: "scheduled", value: report.overview.scheduled },
      { metric: "cancelled", value: report.overview.cancelled },
      { metric: "completed", value: report.overview.completed },
    ]);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, "Overview");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.appointment_status), "AppointmentStatus");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.wards), "Wards");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.record_types), "RecordTypes");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.user_roles), "UserRoles");

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=reports.xlsx");
    return res.send(excelBuffer);
  }

  return res.json({
    message: "Report generated successfully",
    report,
  });
};

router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const report = await getReportData(req);
    return res.json({
      message: "Report generated successfully",
      report,
    });
  } catch (err) {
    console.error("REPORT SUMMARY ERROR:", err);
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Server error" });
  }
});

router.get("/export", authMiddleware, async (req, res) => {
  try {
    const format = normalizeExportFormat(req.query.format);
    const report = await getReportData(req);
    return sendExport(res, format, report);
  } catch (err) {
    console.error("REPORT EXPORT ERROR:", err);
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Server error" });
  }
});

module.exports = router;
