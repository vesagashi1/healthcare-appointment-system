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

-- ============================================
-- Setup Complete (without test data)
-- ============================================
-- 
-- To add test data later, run:
-- \i db/migrations/003_test_data.sql
-- \i db/migrations/004_fix_patient_assignment.sql
--
-- Note: Users must be registered via API first
