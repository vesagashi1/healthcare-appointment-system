-- 007_add_ward_active.sql
-- Add soft-delete flag for wards

ALTER TABLE public.wards
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_wards_active ON public.wards (active);
