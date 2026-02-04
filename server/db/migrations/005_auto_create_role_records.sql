-- ============================================
-- Auto-create role-specific records for existing users
-- This ensures all users with doctor/patient/nurse/caregiver roles
-- have corresponding entries in their respective tables
-- ============================================

SET search_path TO public;

-- Create default wards if they don't exist
INSERT INTO wards (name) VALUES 
  ('General Ward'),
  ('Emergency Ward'),
  ('ICU')
ON CONFLICT (name) DO NOTHING;

-- Auto-create doctor records for all users with doctor role
-- Default specialization: 'General Practice'
INSERT INTO doctors (user_id, specialization)
SELECT DISTINCT u.id, 'General Practice'
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'doctor'
  AND NOT EXISTS (
    SELECT 1 FROM doctors d WHERE d.user_id = u.id
  );

-- Auto-create patient records for all users with patient role
-- Assign to 'General Ward' by default
INSERT INTO patients (user_id, ward_id)
SELECT DISTINCT u.id, (SELECT id FROM wards WHERE name = 'General Ward' LIMIT 1)
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'patient'
  AND NOT EXISTS (
    SELECT 1 FROM patients p WHERE p.user_id = u.id
  );

-- Auto-create nurse records for all users with nurse role
INSERT INTO nurses (user_id)
SELECT DISTINCT u.id
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'nurse'
  AND NOT EXISTS (
    SELECT 1 FROM nurses n WHERE n.user_id = u.id
  );

-- Assign all nurses to General Ward by default
INSERT INTO nurse_wards (nurse_id, ward_id)
SELECT n.id, (SELECT id FROM wards WHERE name = 'General Ward' LIMIT 1)
FROM nurses n
WHERE NOT EXISTS (
  SELECT 1 FROM nurse_wards nw WHERE nw.nurse_id = n.id
);

-- Auto-create caregiver records for all users with caregiver role
INSERT INTO caregivers (user_id)
SELECT DISTINCT u.id
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'caregiver'
  AND NOT EXISTS (
    SELECT 1 FROM caregivers c WHERE c.user_id = u.id
  );

-- Assign all doctors to General Ward by default
INSERT INTO doctor_wards (doctor_id, ward_id)
SELECT d.id, (SELECT id FROM wards WHERE name = 'General Ward' LIMIT 1)
FROM doctors d
WHERE NOT EXISTS (
  SELECT 1 FROM doctor_wards dw WHERE dw.doctor_id = d.id
);

-- Show results
SELECT 'Migration Complete' AS status;
SELECT 'Doctors created:', COUNT(*) FROM doctors;
SELECT 'Patients created:', COUNT(*) FROM patients;
SELECT 'Nurses created:', COUNT(*) FROM nurses;
SELECT 'Caregivers created:', COUNT(*) FROM caregivers;
