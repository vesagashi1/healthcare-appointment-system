-- 008_enhance_rbac_permissions.sql
-- Expand permission model and role mappings for stricter business logic.

SET search_path TO public;

-- New granular permissions
INSERT INTO permissions (name) VALUES
  ('VIEW_USERS'),
  ('VIEW_AUDIT_LOGS'),
  ('VIEW_WARD'),
  ('MANAGE_WARD'),
  ('VIEW_DOCTOR'),
  ('VIEW_NURSE'),
  ('MANAGE_NURSE'),
  ('VIEW_CAREGIVER'),
  ('MANAGE_CAREGIVER_LINK'),
  ('VIEW_PATIENT_LIST'),
  ('MANAGE_PATIENT_PROFILE')
ON CONFLICT (name) DO NOTHING;

-- Admin: keep full access to all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Doctor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'CREATE_PATIENT_RECORD',
  'VIEW_APPOINTMENT',
  'APPROVE_APPOINTMENT',
  'VIEW_PATIENT_LIST',
  'VIEW_DOCTOR',
  'VIEW_NURSE',
  'VIEW_WARD'
)
WHERE r.name = 'doctor'
ON CONFLICT DO NOTHING;

-- Nurse permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'CREATE_PATIENT_RECORD',
  'VIEW_APPOINTMENT',
  'VIEW_PATIENT_LIST',
  'VIEW_NURSE',
  'VIEW_WARD'
)
WHERE r.name = 'nurse'
ON CONFLICT DO NOTHING;

-- Patient permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'CREATE_APPOINTMENT',
  'VIEW_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'VIEW_DOCTOR',
  'VIEW_WARD'
)
WHERE r.name = 'patient'
ON CONFLICT DO NOTHING;

-- Caregiver permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VIEW_PATIENT_RECORD',
  'VIEW_APPOINTMENT',
  'VIEW_DOCTOR',
  'VIEW_WARD',
  'VIEW_CAREGIVER',
  'MANAGE_CAREGIVER_LINK'
)
WHERE r.name = 'caregiver'
ON CONFLICT DO NOTHING;
