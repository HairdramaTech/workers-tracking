-- ============================================================
-- 00005_attendance_payment_status.sql
-- Adds a payment_status column to attendance table
-- Choices: 'pending', 'paid'
-- ============================================================

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid'));
