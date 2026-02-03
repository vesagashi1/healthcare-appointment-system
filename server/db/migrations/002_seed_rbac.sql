-- =========================
-- ROLES
-- =========================
SET search_path TO public;

INSERT INTO roles (name) VALUES
  ('admin'),
  ('doctor'),
  ('nurse'),
  ('patient'),
  ('caregiver')
ON CONFLICT (name) DO NOTHING;


-- =========================
-- PERMISSIONS
-- =========================
INSERT INTO permissions (name) VALUES
  -- Patient records
  ('VIEW_PATIENT_RECORD'),
  ('CREATE_PATIENT_RECORD'),

  -- Appointments
  ('CREATE_APPOINTMENT'),
  ('VIEW_APPOINTMENT'),
  ('APPROVE_APPOINTMENT'),
  ('CANCEL_APPOINTMENT'),

  -- Admin
  ('MANAGE_USERS'),
  ('MANAGE_ROLES')

ON CONFLICT (name) DO NOTHING;


-- =========================
-- ROLE → PERMISSION MAPPING
-- =========================

-- ADMIN: everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;


-- DOCTOR permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'CREATE_PATIENT_RECORD',
  'VIEW_APPOINTMENT',
  'APPROVE_APPOINTMENT'
)
WHERE r.name = 'doctor'
ON CONFLICT DO NOTHING;


-- NURSE permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'CREATE_PATIENT_RECORD',
  'VIEW_APPOINTMENT'
)
WHERE r.name = 'nurse'
ON CONFLICT DO NOTHING;


-- PATIENT permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'CREATE_APPOINTMENT',
  'VIEW_APPOINTMENT',
  'CANCEL_APPOINTMENT'
)
WHERE r.name = 'patient'
ON CONFLICT DO NOTHING;


-- CAREGIVER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'VIEW_APPOINTMENT'
)
WHERE r.name = 'caregiver'
ON CONFLICT DO NOTHING;
