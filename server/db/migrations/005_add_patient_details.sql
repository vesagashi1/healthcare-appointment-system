-- Migration: Add patient details (date_of_birth, gender, blood_type)
-- Date: 2024-12-19

-- Add new columns to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10);

-- Add comments for documentation
COMMENT ON COLUMN patients.date_of_birth IS 'Patient date of birth';
COMMENT ON COLUMN patients.gender IS 'Patient gender (Male, Female, Other)';
COMMENT ON COLUMN patients.blood_type IS 'Patient blood type (A+, A-, B+, B-, AB+, AB-, O+, O-)';
