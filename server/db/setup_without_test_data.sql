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

-- 2. Seed roles and permissions (RBAC)
\i db/migrations/002_seed_rbac.sql

-- 3. Add refresh token persistence table
\i db/migrations/006_add_refresh_tokens.sql

-- ============================================
-- Setup Complete (without test data)
-- ============================================
-- 
-- To add test data later, run:
-- \i db/migrations/003_test_data.sql
-- \i db/migrations/004_fix_patient_assignment.sql
--
-- Note: Users must be registered via API first
