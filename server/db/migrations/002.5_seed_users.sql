-- ============================================
-- Seed Users with Hashed Passwords
-- This creates test users that can be used immediately after setup
-- Run this AFTER 002_seed_rbac.sql (roles must exist)
-- ============================================

SET search_path TO public;

-- Create test users with pre-hashed passwords
-- Passwords: admin123, doctor123, patient123, nurse123, caregiver123

-- Admin User
INSERT INTO users (name, email, password)
VALUES (
  'Admin User',
  'admin@test.com',
  '$2b$10$0x0W8Y3NQesS2/hSrA199Ojnf9XaZjzRMITjqAXK8VNVxfgwaQMQC'
)
ON CONFLICT (email) DO NOTHING;

-- Assign admin role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'admin@test.com' AND r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Doctor User
INSERT INTO users (name, email, password)
VALUES (
  'Dr. Smith',
  'doctor@test.com',
  '$2b$10$fPZUZrgNLcZ0o2gU86R2ZuwkAZFMaLIL/iM/XPt4aw4hRQu2BE79i'
)
ON CONFLICT (email) DO NOTHING;

-- Assign doctor role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'doctor@test.com' AND r.name = 'doctor'
ON CONFLICT DO NOTHING;

-- Patient User
INSERT INTO users (name, email, password)
VALUES (
  'John Patient',
  'patient@test.com',
  '$2b$10$C7ah6cXzqfg0dIF/IKAxredQbauyfsNYgZiTKUjEcEa.uz7k1dqg.'
)
ON CONFLICT (email) DO NOTHING;

-- Assign patient role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'patient@test.com' AND r.name = 'patient'
ON CONFLICT DO NOTHING;

-- Nurse User
INSERT INTO users (name, email, password)
VALUES (
  'Nurse Jane',
  'nurse@test.com',
  '$2b$10$qLWHGwuhqNeyHUX42iOLw.DLWGiekAcinPVnRA4HVFLnK5cXeQSEq'
)
ON CONFLICT (email) DO NOTHING;

-- Assign nurse role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'nurse@test.com' AND r.name = 'nurse'
ON CONFLICT DO NOTHING;

-- Caregiver User
INSERT INTO users (name, email, password)
VALUES (
  'Caregiver Bob',
  'caregiver@test.com',
  '$2b$10$HZfSjfCeZ6/yoj.Zn/L1z.Ngch6YkE53ZyenX7cZHb.QS0DUo30LK'
)
ON CONFLICT (email) DO NOTHING;

-- Assign caregiver role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'caregiver@test.com' AND r.name = 'caregiver'
ON CONFLICT DO NOTHING;

-- Verification
SELECT 'Users seeded successfully' AS status;
SELECT name, email, 
  (SELECT string_agg(r.name, ', ') FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id) as roles
FROM users u
WHERE email IN ('admin@test.com', 'doctor@test.com', 'patient@test.com', 'nurse@test.com', 'caregiver@test.com')
ORDER BY email;
