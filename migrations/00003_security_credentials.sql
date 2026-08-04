-- ============================================================
-- 00003_security_credentials.sql
-- Enables anon DELETE on attendance (needed by security guard
-- History page). Security login now uses Supabase Auth.
-- ============================================================

-- Allow anonymous users to delete attendance records
-- (security guard's History → Delete button)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance'
      AND policyname = 'Allow anonymous delete access to attendance'
  ) THEN
    CREATE POLICY "Allow anonymous delete access to attendance"
      ON attendance FOR DELETE TO anon USING (true);
  END IF;
END
$$;
