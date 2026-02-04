-- ============================================
-- Test Data Setup Script
-- Run this AFTER registering users via API
-- 
-- IMPORTANT: Users must be registered first via:
-- POST /api/auth/register (for each role)
-- 
-- Or this script will fail silently (ON CONFLICT DO NOTHING)
-- ============================================

SET search_path TO public;

-- Step 1: Create Wards
INSERT INTO wards (name) VALUES 
  ('Ward A'),
  ('Ward B'),
  ('Emergency Ward')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Create Doctor Record
-- Replace 2 with your doctor's user_id (check users table first)
-- To find user_id: SELECT id, email FROM users WHERE email = 'doctor@test.com';
INSERT INTO doctors (user_id, specialization) 
SELECT id, 'Cardiology'
FROM users 
WHERE email = 'doctor@test.com'
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Create Patient Record
-- Replace 'patient@test.com' with your patient's email
-- Assigns patient to Ward A (id = 1)
INSERT INTO patients (user_id, ward_id)
SELECT u.id, w.id
FROM users u
CROSS JOIN (SELECT id FROM wards WHERE name = 'Ward A' LIMIT 1) w
WHERE u.email = 'patient@test.com'
ON CONFLICT (user_id)
DO UPDATE SET ward_id = EXCLUDED.ward_id;

-- Step 4: Assign Doctor to Ward
-- Assigns doctor to Ward A
INSERT INTO doctor_wards (doctor_id, ward_id)
SELECT d.id, w.id
FROM doctors d
CROSS JOIN (SELECT id FROM wards WHERE name = 'Ward A' LIMIT 1) w
WHERE d.user_id = (SELECT id FROM users WHERE email = 'doctor@test.com')
ON CONFLICT (doctor_id, ward_id) DO NOTHING;

-- Step 5: Assign Nurse to Ward
-- Replace 'nurse@test.com' with your nurse's email
INSERT INTO nurse_wards (nurse_id, ward_id)
SELECT u.id, w.id
FROM users u
CROSS JOIN (SELECT id FROM wards WHERE name = 'Ward A' LIMIT 1) w
WHERE u.email = 'nurse@test.com'
ON CONFLICT (nurse_id, ward_id) DO NOTHING;

-- Step 6: (Optional) Assign Nurse to Patient
INSERT INTO patient_assignments (patient_id, staff_id, role)
SELECT p.user_id, u.id, 'nurse'
FROM patients p
CROSS JOIN users u
WHERE p.user_id = (SELECT id FROM users WHERE email = 'patient@test.com')
  AND u.email = 'nurse@test.com'
ON CONFLICT (patient_id, staff_id) DO NOTHING;

-- Step 7: (Optional) Link Caregiver to Patient
INSERT INTO patient_caregivers (patient_id, caregiver_id, relationship)
SELECT p.user_id, u.id, 'spouse'
FROM patients p
CROSS JOIN users u
WHERE p.user_id = (SELECT id FROM users WHERE email = 'patient@test.com')
  AND u.email = 'caregiver@test.com'
ON CONFLICT (patient_id, caregiver_id) DO NOTHING;

-- Step 8: Create Appointments (for Doctor pages)
-- Requires doctor + patient rows to exist
INSERT INTO appointments (doctor_id, patient_id, appointment_date, status)
SELECT
  d.id,
  p.id,
  (CURRENT_DATE + TIME '09:30')::timestamp,
  'scheduled'
FROM doctors d
JOIN users u_doctor ON u_doctor.id = d.user_id
JOIN patients p ON TRUE
JOIN users u_patient ON u_patient.id = p.user_id
WHERE u_doctor.email = 'doctor@test.com'
  AND u_patient.email = 'patient@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.doctor_id = d.id
      AND a.patient_id = p.id
      AND a.appointment_date = (CURRENT_DATE + TIME '09:30')::timestamp
  );

INSERT INTO appointments (doctor_id, patient_id, appointment_date, status)
SELECT
  d.id,
  p.id,
  (CURRENT_DATE + INTERVAL '1 day' + TIME '14:00')::timestamp,
  'approved'
FROM doctors d
JOIN users u_doctor ON u_doctor.id = d.user_id
JOIN patients p ON TRUE
JOIN users u_patient ON u_patient.id = p.user_id
WHERE u_doctor.email = 'doctor@test.com'
  AND u_patient.email = 'patient@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.doctor_id = d.id
      AND a.patient_id = p.id
      AND a.appointment_date = (CURRENT_DATE + INTERVAL '1 day' + TIME '14:00')::timestamp
  );

INSERT INTO appointments (doctor_id, patient_id, appointment_date, status)
SELECT
  d.id,
  p.id,
  (CURRENT_DATE - INTERVAL '3 day' + TIME '11:00')::timestamp,
  'completed'
FROM doctors d
JOIN users u_doctor ON u_doctor.id = d.user_id
JOIN patients p ON TRUE
JOIN users u_patient ON u_patient.id = p.user_id
WHERE u_doctor.email = 'doctor@test.com'
  AND u_patient.email = 'patient@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.doctor_id = d.id
      AND a.patient_id = p.id
      AND a.appointment_date = (CURRENT_DATE - INTERVAL '3 day' + TIME '11:00')::timestamp
  );

INSERT INTO appointments (doctor_id, patient_id, appointment_date, status)
SELECT
  d.id,
  p.id,
  (CURRENT_DATE - INTERVAL '1 day' + TIME '16:15')::timestamp,
  'cancelled'
FROM doctors d
JOIN users u_doctor ON u_doctor.id = d.user_id
JOIN patients p ON TRUE
JOIN users u_patient ON u_patient.id = p.user_id
WHERE u_doctor.email = 'doctor@test.com'
  AND u_patient.email = 'patient@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.doctor_id = d.id
      AND a.patient_id = p.id
      AND a.appointment_date = (CURRENT_DATE - INTERVAL '1 day' + TIME '16:15')::timestamp
  );

-- Step 9: Create Patient Records (for dashboard + records page)
-- patient_records.patient_id should reference patients.id
INSERT INTO patient_records (patient_id, created_by, record_type, content)
SELECT
  p.id,
  u_doctor.id,
  'Diagnosis',
  'Hypertension diagnosis. Started lifestyle changes and medication.'
FROM patients p
JOIN users u_patient ON u_patient.id = p.user_id
CROSS JOIN users u_doctor
WHERE u_patient.email = 'patient@test.com'
  AND u_doctor.email = 'doctor@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM patient_records pr
    WHERE pr.patient_id = p.id
      AND pr.created_by = u_doctor.id
      AND pr.record_type = 'Diagnosis'
      AND pr.content = 'Hypertension diagnosis. Started lifestyle changes and medication.'
  );

INSERT INTO patient_records (patient_id, created_by, record_type, content)
SELECT
  p.id,
  u_doctor.id,
  'Treatment',
  'Diabetes follow-up treatment plan. Reviewed medication adherence.'
FROM patients p
JOIN users u_patient ON u_patient.id = p.user_id
CROSS JOIN users u_doctor
WHERE u_patient.email = 'patient@test.com'
  AND u_doctor.email = 'doctor@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM patient_records pr
    WHERE pr.patient_id = p.id
      AND pr.created_by = u_doctor.id
      AND pr.record_type = 'Treatment'
      AND pr.content = 'Diabetes follow-up treatment plan. Reviewed medication adherence.'
  );

INSERT INTO patient_records (patient_id, created_by, record_type, content)
SELECT
  p.id,
  u_doctor.id,
  'Lab Results',
  'BP 140/90. Cholesterol within normal range. Recommended recheck in 4 weeks.'
FROM patients p
JOIN users u_patient ON u_patient.id = p.user_id
CROSS JOIN users u_doctor
WHERE u_patient.email = 'patient@test.com'
  AND u_doctor.email = 'doctor@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM patient_records pr
    WHERE pr.patient_id = p.id
      AND pr.created_by = u_doctor.id
      AND pr.record_type = 'Lab Results'
      AND pr.content = 'BP 140/90. Cholesterol within normal range. Recommended recheck in 4 weeks.'
  );

-- ============================================
-- Verification Queries
-- ============================================

-- Summary
SELECT 'Wards' as table_name, COUNT(*) as count FROM wards
UNION ALL
SELECT 'Doctors', COUNT(*) FROM doctors
UNION ALL
SELECT 'Patients', COUNT(*) FROM patients
UNION ALL
SELECT 'Doctor-Ward Links', COUNT(*) FROM doctor_wards
UNION ALL
SELECT 'Nurse-Ward Links', COUNT(*) FROM nurse_wards
UNION ALL
SELECT 'Patient Assignments', COUNT(*) FROM patient_assignments
UNION ALL
SELECT 'Caregiver Links', COUNT(*) FROM patient_caregivers;

-- View complete setup
SELECT 
  'Doctor' as type,
  u.name,
  u.email,
  d.specialization,
  w.name as ward_name
FROM doctors d
JOIN users u ON d.user_id = u.id
JOIN doctor_wards dw ON d.id = dw.doctor_id
JOIN wards w ON dw.ward_id = w.id

UNION ALL

SELECT 
  'Patient' as type,
  u.name,
  u.email,
  NULL as specialization,
  w.name as ward_name
FROM patients p
JOIN users u ON p.user_id = u.id
LEFT JOIN wards w ON p.ward_id = w.id;

-- Appointments and records counts (useful for Doctor dashboard)
SELECT 'Appointments' as table_name, COUNT(*) as count FROM appointments
UNION ALL
SELECT 'Patient Records', COUNT(*) FROM patient_records;
