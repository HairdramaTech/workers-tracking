-- ============================================================
-- 00004_work_orders_status.sql
-- Adds a status column to work_orders to track completion.
-- Choices: 'open', 'completed'
-- ============================================================

ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed'));
