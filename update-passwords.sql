-- ============================================
-- Update User Passwords
-- ============================================
-- Run this in Supabase SQL Editor to change passwords

-- Example: Change password to 'newpassword123' for all users
-- The hash below is for 'newpassword123'
-- Generated with: bcrypt.hash('newpassword123', 10)

UPDATE users SET password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGjE7Cu8.KdYCzgx.i' WHERE username = 'Wudh';
UPDATE users SET password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGjE7Cu8.KdYCzgx.i' WHERE username = 'Keeratika';
UPDATE users SET password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGjE7Cu8.KdYCzgx.i' WHERE username = 'Kanokkotchakorn';

-- ============================================
-- Or update individually:
-- ============================================

-- For Wudh only (password: 'admin123'):
-- UPDATE users SET password = '$2b$10$dN.l0QCzZf4y4xPJGqKZueadjZCk5y0gKZPJYq0QGq0L8y6jKKmEO' WHERE username = 'Wudh';

-- For Keeratika only (password: 'keeratika456'):
-- UPDATE users SET password = '$2b$10$YourHashHere' WHERE username = 'Keeratika';

-- ============================================
-- Generate new password hash:
-- ============================================
-- You can use the hash-passwords.js script:
-- node hash-passwords.js

