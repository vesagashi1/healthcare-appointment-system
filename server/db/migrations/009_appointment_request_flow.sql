-- 009_appointment_request_flow.sql
-- Patient creates appointment as request; doctor approval schedules it.

SET search_path TO public;

-- New default for new appointments
ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'requested';

-- Migrate legacy approved appointments to scheduled
UPDATE public.appointments
SET status = 'scheduled'
WHERE status = 'approved';

-- Update valid status set
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status = ANY (ARRAY['requested', 'scheduled', 'completed', 'cancelled', 'no_show'])
  );

-- Keep uniqueness for active bookable statuses
DROP INDEX IF EXISTS uniq_doctor_active_slot;
DROP INDEX IF EXISTS uniq_doctor_time;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_doctor_active_slot
  ON public.appointments (doctor_id, appointment_date)
  WHERE status = ANY (ARRAY['requested', 'scheduled']);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_doctor_time
  ON public.appointments (doctor_id, appointment_date)
  WHERE status = ANY (ARRAY['requested', 'scheduled']);
