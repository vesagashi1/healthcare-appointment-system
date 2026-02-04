-- ============================================
-- Fix Schema Foreign Keys
--
-- This project started from a pg_dump where some FK constraints
-- incorrectly point to users(id) instead of role-specific tables.
-- These fixes are required for doctor/patient pages to work reliably.
--
-- Safe to run multiple times.
-- ============================================

SET search_path TO public;

BEGIN;

-- If doctor_wards.doctor_id contains users.id values, map them to doctors.id
UPDATE doctor_wards dw
SET doctor_id = d.id
FROM doctors d
WHERE dw.doctor_id = d.user_id;

ALTER TABLE doctor_wards
  DROP CONSTRAINT IF EXISTS doctor_wards_doctor_id_fkey;

ALTER TABLE doctor_wards
  ADD CONSTRAINT doctor_wards_doctor_id_fkey
  FOREIGN KEY (doctor_id)
  REFERENCES doctors(id)
  ON DELETE CASCADE;

-- If patient_records.patient_id contains users.id values, map them to patients.id
UPDATE patient_records pr
SET patient_id = p.id
FROM patients p
WHERE pr.patient_id = p.user_id;

ALTER TABLE patient_records
  DROP CONSTRAINT IF EXISTS patient_records_patient_id_fkey;

ALTER TABLE patient_records
  ADD CONSTRAINT patient_records_patient_id_fkey
  FOREIGN KEY (patient_id)
  REFERENCES patients(id)
  ON DELETE CASCADE;

COMMIT;
