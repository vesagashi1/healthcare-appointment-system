-- db/setup.sql
-- Complete database setup script
-- Run with: npm run db:setup
-- Or: psql -U your_username -d postgres -f db/setup.sql

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

-- 3. Create test data (wards, doctor records, patient records, assignments)
--    This creates test users relationships for development/testing
\i db/migrations/003_test_data.sql

-- 4. Fix any patient assignment issues (ensures correct data)
\i db/migrations/004_fix_patient_assignment.sql

-- 5. Add patient details (date_of_birth, gender, blood_type)
\i db/migrations/005_add_patient_details.sql

-- ============================================
-- Setup Complete!
-- ============================================
-- 
-- Test users created (via API registration):
-- - admin@test.com / admin123
-- - doctor@test.com / doctor123
-- - patient@test.com / patient123
-- - nurse@test.com / nurse123
-- - caregiver@test.com / caregiver123
--
-- Note: Users must be registered via API first before running migrations 003 and 004
-- See SETUP.md for complete setup instructions
