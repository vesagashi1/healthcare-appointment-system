-- db/setup.sql

-- Create database (safe)
CREATE DATABASE healthcare_db;

\c healthcare_db

-- Run migrations (ORDER MATTERS)
\i db/migrations/001_initial_schema.sql
\i db/migrations/002_seed_rbac.sql
