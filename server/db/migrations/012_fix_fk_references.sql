-- 012_fix_fk_references.sql
-- Fix foreign-key references so every patient_id means the same thing
-- and doctor_wards.doctor_id correctly targets the doctors table.
--
-- BEFORE: doctor_wards.doctor_id  → users(id)     (wrong – code stores doctors.id)
--         patient_records.patient_id      → users(id)
--         patient_assignments.patient_id  → users(id)
--         patient_caregivers.patient_id   → users(id)
--         appointments.patient_id         → patients(id)   ← already correct
--
-- AFTER:  All patient_id columns → patients(id)
--         doctor_wards.doctor_id → doctors(id)

SET search_path TO public;

-- ============================================================
-- 1. Fix doctor_wards.doctor_id → doctors(id)
-- ============================================================
ALTER TABLE doctor_wards
  DROP CONSTRAINT IF EXISTS doctor_wards_doctor_id_fkey;

ALTER TABLE doctor_wards
  ADD CONSTRAINT doctor_wards_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Migrate patient_records.patient_id  (users.id → patients.id)
-- ============================================================
-- The immutability trigger blocks UPDATE/DELETE, so disable it first.
ALTER TABLE patient_records DISABLE TRIGGER no_update_patient_records;

UPDATE patient_records pr
SET    patient_id = p.id
FROM   patients p
WHERE  pr.patient_id = p.user_id;

ALTER TABLE patient_records ENABLE TRIGGER no_update_patient_records;

ALTER TABLE patient_records
  DROP CONSTRAINT IF EXISTS patient_records_patient_id_fkey;

ALTER TABLE patient_records
  ADD CONSTRAINT patient_records_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- ============================================================
-- 3. Migrate patient_assignments.patient_id  (users.id → patients.id)
-- ============================================================
-- Drop the unique constraint that includes patient_id first,
-- then migrate data, then re-create it.
ALTER TABLE patient_assignments
  DROP CONSTRAINT IF EXISTS patient_assignments_patient_id_staff_id_key;

UPDATE patient_assignments pa
SET    patient_id = p.id
FROM   patients p
WHERE  pa.patient_id = p.user_id;

ALTER TABLE patient_assignments
  ADD CONSTRAINT patient_assignments_patient_id_staff_id_key
  UNIQUE (patient_id, staff_id);

ALTER TABLE patient_assignments
  DROP CONSTRAINT IF EXISTS patient_assignments_patient_id_fkey;

ALTER TABLE patient_assignments
  ADD CONSTRAINT patient_assignments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- ============================================================
-- 4. Migrate patient_caregivers.patient_id  (users.id → patients.id)
-- ============================================================
ALTER TABLE patient_caregivers
  DROP CONSTRAINT IF EXISTS patient_caregivers_patient_id_caregiver_id_key;

UPDATE patient_caregivers pc
SET    patient_id = p.id
FROM   patients p
WHERE  pc.patient_id = p.user_id;

ALTER TABLE patient_caregivers
  ADD CONSTRAINT patient_caregivers_patient_id_caregiver_id_key
  UNIQUE (patient_id, caregiver_id);

ALTER TABLE patient_caregivers
  DROP CONSTRAINT IF EXISTS patient_caregivers_patient_id_fkey;

ALTER TABLE patient_caregivers
  ADD CONSTRAINT patient_caregivers_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
