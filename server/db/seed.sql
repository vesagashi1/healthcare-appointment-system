-- db/seed.sql
-- Adds development/test data without dropping the DB.
-- Safe to run multiple times.
--
-- Usage:
--   psql -U postgres -d healthcare_db -f db/seed.sql

\c healthcare_db

SET search_path TO public;

\i db/migrations/006_fix_foreign_keys.sql
\i db/migrations/003_test_data.sql
\i db/migrations/004_fix_patient_assignment.sql
