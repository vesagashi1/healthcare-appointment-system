-- ============================================
-- Fix Patient Assignment
-- This fixes the patient_assignments table
-- to ensure John Patient is assigned, not Admin User
-- 
-- IMPORTANT: Run this AFTER 003_test_data.sql
-- This ensures correct patient assignments
-- ============================================

-- First, let's see what's currently in patient_assignments
SELECT 
  pa.id,
  pa.patient_id,
  u_patient.name as patient_name,
  pa.staff_id,
  u_staff.name as staff_name,
  pa.role
FROM patient_assignments pa
JOIN users u_patient ON pa.patient_id = u_patient.id
JOIN users u_staff ON pa.staff_id = u_staff.id;

-- Delete ALL incorrect assignments first
-- Delete any assignment where patient_id doesn't match an actual patient's user_id
DELETE FROM patient_assignments
WHERE patient_id NOT IN (SELECT user_id FROM patients WHERE user_id IS NOT NULL);

-- Alternative: Delete specific incorrect assignment (Admin User)
DELETE FROM patient_assignments
WHERE patient_id = (SELECT id FROM users WHERE email = 'admin@test.com');

-- Create correct patient assignment
-- IMPORTANT: patient_assignments.patient_id references users.id (not patients.id)
-- So we need to use the patient's user_id from the patients table
INSERT INTO patient_assignments (patient_id, staff_id, role)
SELECT 
  p.user_id as patient_id,  -- Use user_id from patients table, not patients.id
  u.id as staff_id,
  'nurse' as role
FROM patients p
CROSS JOIN users u
WHERE p.user_id = (SELECT id FROM users WHERE email = 'patient@test.com')
  AND u.email = 'nurse@test.com'
ON CONFLICT (patient_id, staff_id) DO NOTHING;

-- Verify the fix - should show "John Patient" not "Admin User"
SELECT 
  pa.id,
  pa.patient_id,
  u_patient.name as patient_name,
  u_patient.email as patient_email,
  pa.staff_id,
  u_staff.name as staff_name,
  pa.role
FROM patient_assignments pa
JOIN users u_patient ON pa.patient_id = u_patient.id
JOIN users u_staff ON pa.staff_id = u_staff.id;

-- ============================================
-- Fix Caregiver Link (if needed)
-- ============================================

-- Delete incorrect caregiver links
-- Delete any link where patient_id doesn't match an actual patient's user_id
DELETE FROM patient_caregivers
WHERE patient_id NOT IN (SELECT user_id FROM patients WHERE user_id IS NOT NULL);

-- Alternative: Delete specific incorrect link (Admin User)
DELETE FROM patient_caregivers
WHERE patient_id = (SELECT id FROM users WHERE email = 'admin@test.com');

-- Create correct caregiver link
-- IMPORTANT: patient_caregivers.patient_id also references users.id (not patients.id)
-- So we need to use the patient's user_id from the patients table
INSERT INTO patient_caregivers (patient_id, caregiver_id, relationship)
SELECT 
  p.user_id as patient_id,  -- Use user_id from patients table, not patients.id
  u.id as caregiver_id,
  'spouse' as relationship
FROM patients p
CROSS JOIN users u
WHERE p.user_id = (SELECT id FROM users WHERE email = 'patient@test.com')
  AND u.email = 'caregiver@test.com'
ON CONFLICT (patient_id, caregiver_id) DO NOTHING;

-- Verify caregiver link fix
SELECT 
  pc.id,
  u_patient.name as patient_name,
  u_caregiver.name as caregiver_name,
  pc.relationship
FROM patient_caregivers pc
JOIN users u_patient ON pc.patient_id = u_patient.id
JOIN users u_caregiver ON pc.caregiver_id = u_caregiver.id;
