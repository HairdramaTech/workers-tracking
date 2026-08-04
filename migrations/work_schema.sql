-- =====================================================
-- WORK MANAGEMENT SCHEMA (Phase 3 Extension)
-- Run this AFTER schema.sql in Supabase SQL Editor
-- =====================================================

-- 1. Work types (e.g. "Box Packing", "Stitching")
CREATE TABLE IF NOT EXISTS work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Work orders — a batch of work to be done
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id UUID REFERENCES work_types(id) ON DELETE SET NULL,
  sku TEXT,                          -- optional product/batch code
  total_quantity INTEGER NOT NULL,   -- total units in this order
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Work assignments — one work order can be split across multiple workers
CREATE TABLE IF NOT EXISTS work_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  assigned_quantity INTEGER NOT NULL,
  done_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'under_review', 'completed')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (work_order_id, worker_id)  -- each worker gets one assignment per order
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE work_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_assignments ENABLE ROW LEVEL SECURITY;

-- work_types: anyone can read, only authenticated (manager) can write
CREATE POLICY "anon_read_work_types"   ON work_types FOR SELECT TO anon USING (true);
CREATE POLICY "auth_all_work_types"    ON work_types FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- work_orders: anyone can read, only manager can write
CREATE POLICY "anon_read_work_orders"  ON work_orders FOR SELECT TO anon USING (true);
CREATE POLICY "auth_all_work_orders"   ON work_orders FOR ALL   TO authenticated USING (true) WITH CHECK (true);

-- work_assignments: workers can read/update their own rows; manager has full access
CREATE POLICY "anon_read_work_assignments"   ON work_assignments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_work_assignments" ON work_assignments FOR UPDATE TO anon
  USING (true) WITH CHECK (status IN ('in_progress', 'under_review')); -- workers can only move forward
CREATE POLICY "auth_all_work_assignments"    ON work_assignments FOR ALL   TO authenticated USING (true) WITH CHECK (true);
