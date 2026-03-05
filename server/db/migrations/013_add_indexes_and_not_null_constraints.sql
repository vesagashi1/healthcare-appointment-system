-- Add missing indexes and enforce required NOT NULL constraints.
-- This migration is idempotent where possible.

SET search_path TO public;

-- ============================================
-- 1) Missing indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
  ON public.appointments (patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_appointment_date
  ON public.appointments (appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON public.appointments (status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_patient_records_patient_id
  ON public.patient_records (patient_id);

CREATE INDEX IF NOT EXISTS idx_patients_ward_id
  ON public.patients (ward_id);

CREATE INDEX IF NOT EXISTS idx_patient_assignments_staff_id
  ON public.patient_assignments (staff_id);

CREATE INDEX IF NOT EXISTS idx_patient_caregivers_caregiver_id
  ON public.patient_caregivers (caregiver_id);

-- ============================================
-- 2) Backfill nullable semantic-required fields
-- ============================================

-- Infer patient_assignments.role from the assigned staff's RBAC role.
UPDATE public.patient_assignments pa
SET role = inferred.role
FROM (
  SELECT
    pa2.id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = pa2.staff_id
          AND r.name = 'doctor'
      ) THEN 'doctor'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = pa2.staff_id
          AND r.name = 'nurse'
      ) THEN 'nurse'
      ELSE NULL
    END AS role
  FROM public.patient_assignments pa2
  WHERE pa2.role IS NULL
) AS inferred
WHERE pa.id = inferred.id
  AND inferred.role IS NOT NULL;

-- Default relationship to 'caregiver' when missing/blank.
UPDATE public.patient_caregivers
SET relationship = 'caregiver'
WHERE relationship IS NULL
   OR btrim(relationship) = '';

-- Guard: fail early if unresolved rows remain.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.patient_assignments WHERE role IS NULL) THEN
    RAISE EXCEPTION
      'Cannot set patient_assignments.role NOT NULL: unresolved NULL role values remain';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.doctors WHERE user_id IS NULL) THEN
    RAISE EXCEPTION
      'Cannot set doctors.user_id NOT NULL: NULL user_id values exist';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.patients WHERE user_id IS NULL) THEN
    RAISE EXCEPTION
      'Cannot set patients.user_id NOT NULL: NULL user_id values exist';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.nurses WHERE user_id IS NULL) THEN
    RAISE EXCEPTION
      'Cannot set nurses.user_id NOT NULL: NULL user_id values exist';
  END IF;
END $$;

-- ============================================
-- 3) Enforce NOT NULL constraints
-- ============================================

ALTER TABLE public.doctors
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.patients
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.nurses
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.patient_assignments
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.patient_caregivers
  ALTER COLUMN relationship SET NOT NULL;
