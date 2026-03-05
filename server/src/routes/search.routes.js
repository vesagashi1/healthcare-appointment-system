const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const pool = require("../config/db");

const router = express.Router();

const ENTITY_CONFIG = {
  patients: {
    sortMap: {
      name: "u.name",
      email: "u.email",
      created_at: "u.created_at",
      ward_name: "w.name",
    },
    defaultSort: "u.name",
  },
  doctors: {
    sortMap: {
      name: "u.name",
      email: "u.email",
      specialization: "d.specialization",
      created_at: "u.created_at",
    },
    defaultSort: "u.name",
  },
  appointments: {
    sortMap: {
      appointment_date: "a.appointment_date",
      status: "a.status",
      doctor_name: "u_doctor.name",
      patient_name: "u_patient.name",
      created_at: "a.created_at",
    },
    defaultSort: "a.appointment_date",
  },
  records: {
    sortMap: {
      created_at: "pr.created_at",
      record_type: "pr.record_type",
      patient_name: "u_patient.name",
      created_by: "u_creator.name",
    },
    defaultSort: "pr.created_at",
  },
  users: {
    sortMap: {
      name: "u.name",
      email: "u.email",
      created_at: "u.created_at",
      role: "roles",
    },
    defaultSort: "u.created_at",
  },
};

const normalizeSortOrder = (value) =>
  (value || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

const parsePagination = (query) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  return { limit, page, offset };
};

const ensureSearchableEntity = (entity) => {
  if (!ENTITY_CONFIG[entity]) {
    const err = new Error("Invalid search entity");
    err.status = 400;
    throw err;
  }
};

const buildPatientsSearch = async (req, { sortBy, sortOrder, limit, offset }) => {
  const values = [];
  let where = "WHERE 1=1";
  const { q, ward_id } = req.query;
  const role = req.user.role;

  if (role === "patient") {
    where += ` AND p.user_id = $${values.push(req.user.id)}`;
  } else if (role === "caregiver") {
    where += ` AND EXISTS (
      SELECT 1 FROM patient_caregivers pc
      WHERE pc.patient_id = p.id AND pc.caregiver_id = $${values.push(req.user.id)}
    )`;
  } else if (role === "doctor") {
    where += ` AND EXISTS (
      SELECT 1
      FROM doctors d
      JOIN doctor_wards dw ON dw.doctor_id = d.id
      WHERE d.user_id = $${values.push(req.user.id)}
        AND dw.ward_id = p.ward_id
    )`;
  } else if (role === "nurse") {
    where += ` AND (
      EXISTS (
        SELECT 1 FROM nurse_wards nw
        WHERE nw.nurse_id = $${values.push(req.user.id)}
          AND nw.ward_id = p.ward_id
      )
      OR EXISTS (
        SELECT 1 FROM patient_assignments pa
        WHERE pa.staff_id = $${values.push(req.user.id)}
          AND pa.patient_id = p.id
          AND pa.role = 'nurse'
      )
    )`;
  } else if (role !== "admin") {
    const err = new Error("Not authorized to search patients");
    err.status = 403;
    throw err;
  }

  if (q) {
    where += ` AND (
      u.name ILIKE $${values.push(`%${q}%`)}
      OR u.email ILIKE $${values.push(`%${q}%`)}
      OR COALESCE(w.name, '') ILIKE $${values.push(`%${q}%`)}
    )`;
  }

  if (ward_id) {
    where += ` AND p.ward_id = $${values.push(ward_id)}`;
  }

  const query = `
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
      u.created_at,
      COUNT(*) OVER()::int as total_count
    FROM patients p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN wards w ON p.ward_id = w.id
    ${where}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}
  `;

  const result = await pool.query(query, values);
  return {
    items: result.rows,
    count: result.rows[0]?.total_count || 0,
  };
};

const buildDoctorsSearch = async (req, { sortBy, sortOrder, limit, offset }) => {
  const values = [];
  let where = "WHERE 1=1";
  const { q, specialization } = req.query;

  if (q) {
    where += ` AND (
      u.name ILIKE $${values.push(`%${q}%`)}
      OR u.email ILIKE $${values.push(`%${q}%`)}
      OR d.specialization ILIKE $${values.push(`%${q}%`)}
    )`;
  }

  if (specialization) {
    where += ` AND d.specialization ILIKE $${values.push(`%${specialization}%`)}`;
  }

  const query = `
    SELECT
      d.id,
      d.specialization,
      u.id as user_id,
      u.name,
      u.email,
      u.created_at,
      COUNT(*) OVER()::int as total_count
    FROM doctors d
    JOIN users u ON d.user_id = u.id
    ${where}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}
  `;

  const result = await pool.query(query, values);
  return {
    items: result.rows,
    count: result.rows[0]?.total_count || 0,
  };
};

const buildAppointmentsSearch = async (req, { sortBy, sortOrder, limit, offset }) => {
  const values = [];
  let where = "WHERE 1=1";
  const { q, status, ward_id, start_date, end_date } = req.query;
  const role = req.user.role;

  if (role === "patient") {
    where += ` AND p.user_id = $${values.push(req.user.id)}`;
  } else if (role === "doctor") {
    where += ` AND d.user_id = $${values.push(req.user.id)}`;
  } else if (role === "caregiver") {
    where += ` AND EXISTS (
      SELECT 1 FROM patient_caregivers pc
      WHERE pc.patient_id = p.id AND pc.caregiver_id = $${values.push(req.user.id)}
    )`;
  }

  if (q) {
    where += ` AND (
      u_doctor.name ILIKE $${values.push(`%${q}%`)}
      OR u_patient.name ILIKE $${values.push(`%${q}%`)}
      OR a.status ILIKE $${values.push(`%${q}%`)}
    )`;
  }

  if (status) {
    where += ` AND a.status = $${values.push(status)}`;
  }

  if (ward_id) {
    where += ` AND p.ward_id = $${values.push(ward_id)}`;
  }

  if (start_date) {
    where += ` AND a.appointment_date >= $${values.push(start_date)}`;
  }

  if (end_date) {
    where += ` AND a.appointment_date <= $${values.push(end_date)}`;
  }

  const query = `
    SELECT
      a.id,
      a.appointment_date,
      a.status,
      a.created_at,
      d.id as doctor_id,
      d.specialization,
      u_doctor.name as doctor_name,
      u_patient.name as patient_name,
      p.id as patient_id,
      p.ward_id,
      w.name as ward_name,
      COUNT(*) OVER()::int as total_count
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN users u_doctor ON d.user_id = u_doctor.id
    JOIN patients p ON a.patient_id = p.id
    JOIN users u_patient ON p.user_id = u_patient.id
    LEFT JOIN wards w ON p.ward_id = w.id
    ${where}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}
  `;

  const result = await pool.query(query, values);
  return {
    items: result.rows,
    count: result.rows[0]?.total_count || 0,
  };
};

const buildRecordsSearch = async (req, { sortBy, sortOrder, limit, offset }) => {
  const values = [];
  let where = "WHERE 1=1";
  const { q, record_type, ward_id, start_date, end_date } = req.query;
  const role = req.user.role;

  if (role === "patient") {
    where += ` AND p.user_id = $${values.push(req.user.id)} AND pr.record_type = 'patient_note'`;
  } else if (role === "doctor") {
    where += ` AND EXISTS (
      SELECT 1
      FROM doctors d
      JOIN doctor_wards dw ON dw.doctor_id = d.id
      WHERE d.user_id = $${values.push(req.user.id)}
        AND dw.ward_id = p.ward_id
    )`;
  } else if (role === "nurse") {
    where += ` AND (
      EXISTS (
        SELECT 1 FROM patient_assignments pa
        WHERE pa.staff_id = $${values.push(req.user.id)}
          AND pa.patient_id = p.id
          AND pa.role = 'nurse'
      )
      OR EXISTS (
        SELECT 1 FROM nurse_wards nw
        WHERE nw.nurse_id = $${values.push(req.user.id)}
          AND nw.ward_id = p.ward_id
      )
    ) AND pr.record_type IN ('nursing_note', 'patient_note')`;
  } else if (role === "caregiver") {
    where += ` AND EXISTS (
      SELECT 1 FROM patient_caregivers pc
      WHERE pc.patient_id = p.id AND pc.caregiver_id = $${values.push(req.user.id)}
    ) AND pr.record_type IN ('nursing_note', 'patient_note')`;
  }

  if (q) {
    where += ` AND (
      u_patient.name ILIKE $${values.push(`%${q}%`)}
      OR u_creator.name ILIKE $${values.push(`%${q}%`)}
      OR pr.record_type ILIKE $${values.push(`%${q}%`)}
      OR pr.content ILIKE $${values.push(`%${q}%`)}
    )`;
  }

  if (record_type) {
    where += ` AND pr.record_type = $${values.push(record_type)}`;
  }

  if (ward_id) {
    where += ` AND p.ward_id = $${values.push(ward_id)}`;
  }

  if (start_date) {
    where += ` AND pr.created_at >= $${values.push(start_date)}`;
  }

  if (end_date) {
    where += ` AND pr.created_at <= $${values.push(end_date)}`;
  }

  const query = `
    SELECT
      pr.id,
      pr.record_type,
      pr.content,
      pr.created_at,
      pr.corrected_record_id,
      u_patient.id as patient_user_id,
      u_patient.name as patient_name,
      u_creator.name as created_by_name,
      p.id as patient_id,
      p.ward_id,
      w.name as ward_name,
      COUNT(*) OVER()::int as total_count
    FROM patient_records pr
    JOIN patients p ON pr.patient_id = p.id
    JOIN users u_patient ON p.user_id = u_patient.id
    LEFT JOIN users u_creator ON pr.created_by = u_creator.id
    LEFT JOIN wards w ON p.ward_id = w.id
    ${where}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}
  `;

  const result = await pool.query(query, values);
  return {
    items: result.rows,
    count: result.rows[0]?.total_count || 0,
  };
};

const buildUsersSearch = async (req, { sortBy, sortOrder, limit, offset }) => {
  if (req.user.role !== "admin") {
    const err = new Error("Only admin can search users");
    err.status = 403;
    throw err;
  }

  const values = [];
  let where = "WHERE 1=1";
  const { q, role } = req.query;

  if (q) {
    where += ` AND (
      u.name ILIKE $${values.push(`%${q}%`)}
      OR u.email ILIKE $${values.push(`%${q}%`)}
    )`;
  }

  if (role) {
    where += ` AND EXISTS (
      SELECT 1
      FROM user_roles ur_filter
      JOIN roles r_filter ON r_filter.id = ur_filter.role_id
      WHERE ur_filter.user_id = u.id AND r_filter.name = $${values.push(role)}
    )`;
  }

  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.created_at,
      STRING_AGG(DISTINCT r.name, ', ') as roles,
      COUNT(*) OVER()::int as total_count
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ${where}
    GROUP BY u.id, u.name, u.email, u.created_at
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}
  `;

  const result = await pool.query(query, values);
  return {
    items: result.rows,
    count: result.rows[0]?.total_count || 0,
  };
};

const SEARCH_HANDLERS = {
  patients: buildPatientsSearch,
  doctors: buildDoctorsSearch,
  appointments: buildAppointmentsSearch,
  records: buildRecordsSearch,
  users: buildUsersSearch,
};

router.get("/:entity", authMiddleware, async (req, res) => {
  try {
    const entity = (req.params.entity || "").toLowerCase();
    ensureSearchableEntity(entity);

    const config = ENTITY_CONFIG[entity];
    const requestedSortBy = req.query.sort_by;
    const sortBy = config.sortMap[requestedSortBy] || config.defaultSort;
    const sortOrder = normalizeSortOrder(req.query.sort_order);
    const { limit, page, offset } = parsePagination(req.query);

    const result = await SEARCH_HANDLERS[entity](req, {
      sortBy,
      sortOrder,
      limit,
      offset,
    });

    return res.json({
      message: "Search results retrieved successfully",
      entity,
      items: result.items,
      count: result.count,
      page,
      limit,
    });
  } catch (err) {
    console.error("ADVANCED SEARCH ERROR:", err);
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Server error" });
  }
});

module.exports = router;
