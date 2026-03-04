-- 008_add_user_active.sql
-- Add soft-delete / suspend flag for users (used primarily for nurse suspend)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_active ON public.users (active);
