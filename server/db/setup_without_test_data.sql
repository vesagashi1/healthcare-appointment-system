-- db/setup_without_test_data.sql
-- Database setup WITHOUT test data
-- Use this if you only want schema and RBAC, no test data

-- Create database (safe - won't error if exists)
CREATE DATABASE healthcare_db;

\c healthcare_db

-- ============================================
-- Run migrations in order (ORDER MATTERS!)
-- ============================================

-- 1. Create all tables and schema
\i db/migrations/001_initial_schema.sql

-- 001_initial_schema.sql comes from a pg_dump and explicitly empties search_path.
-- Reset it so subsequent migrations can use unqualified table names.
SET search_path TO public;

-- 2. Seed roles and permissions (RBAC)
\i db/migrations/002_seed_rbac.sql

-- 3. Add patient details (date_of_birth, gender, blood_type)
\i db/migrations/005_add_patient_details.sql

-- 4. Add refresh token persistence table
\i db/migrations/006_add_refresh_tokens.sql

-- 5. Add ward soft-delete flag
\i db/migrations/007_add_ward_active.sql

-- 6. Enhance RBAC permissions and mappings
\i db/migrations/008_enhance_rbac_permissions.sql

-- 7. Appointment request -> schedule approval flow
\i db/migrations/009_appointment_request_flow.sql

-- 8. Add user soft-delete flag
\i db/migrations/010_add_user_active.sql

-- 9. Create nurses table
\i db/migrations/011_create_nurses_table.sql

-- 10. Fix FK references (doctor_wards → doctors, patient_id → patients)
\i db/migrations/012_fix_fk_references.sql

-- 11. Add performance indexes and tighten NOT NULL constraints
\i db/migrations/013_add_indexes_and_not_null_constraints.sql

-- ============================================
-- Setup Complete (without test data)
-- ============================================
-- 
-- To add test data later, run:
-- \i db/migrations/003_test_data.sql
-- \i db/migrations/004_fix_patient_assignment.sql
--
-- Note: Users must be registered via API first
