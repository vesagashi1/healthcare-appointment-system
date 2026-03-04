-- 009_create_nurses_table.sql
-- Create nurses table (mirrors doctors table structure)

CREATE TABLE IF NOT EXISTS public.nurses (
    id integer NOT NULL,
    user_id integer
);

CREATE SEQUENCE IF NOT EXISTS public.nurses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.nurses_id_seq OWNED BY public.nurses.id;

ALTER TABLE ONLY public.nurses
    ALTER COLUMN id SET DEFAULT nextval('public.nurses_id_seq'::regclass);

ALTER TABLE ONLY public.nurses
    ADD CONSTRAINT nurses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.nurses
    ADD CONSTRAINT nurses_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.nurses
    ADD CONSTRAINT nurses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Populate nurses table from existing nurse users
INSERT INTO public.nurses (user_id)
SELECT DISTINCT u.id
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'nurse'
ON CONFLICT (user_id) DO NOTHING;
