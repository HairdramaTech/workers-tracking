/**
 * Seed Manager Account
 * --------------------
 * BEFORE running this script:
 *   1. Go to Supabase Dashboard → Authentication → Providers → Email
 *   2. Disable "Confirm email" (toggle OFF)
 *   3. Save, then run: node backend/scripts/seed-manager.mjs
 *
 * Manager credentials:
 *   Email   : manager@admin.com
 *   Password: admin123
 *
 * On the login page use: manager@admin.com / admin123
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmxxtdwwoiysrxtcipcf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxteHh0ZHd3b2l5c3J4dGNpcGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjQxNzIsImV4cCI6MjEwMTQwMDE3Mn0.g3FrrAGBHWoEYztBHRJCXnglhGZT87sSje-5XMItgTY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log('Creating manager account…');

  const { data, error } = await supabase.auth.signUp({
    email: 'manager@admin.com',
    password: 'admin123',
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('✅ Manager account already exists — nothing to do.');
    } else {
      console.error('❌ Error:', error.message);
      console.log(
        '\nAlternative: run this SQL in the Supabase SQL Editor:\n',
        `SELECT auth.uid() FROM auth.users WHERE email = 'manager@admin.com';`
      );
      console.log(
        'If no row, go to Supabase Dashboard → Authentication → Users → Add User\n',
        '  Email: manager@admin.com\n',
        '  Password: admin123'
      );
    }
    return;
  }

  if (data?.user) {
    console.log('✅ Manager account created:', data.user.email);
    console.log('   Login: manager@admin.com / admin123');
  } else {
    console.log(
      '⚠️  Account created but email confirmation may be pending.\n' +
      '   Disable email confirmation in Supabase Auth settings and try again,\n' +
      '   OR manually create the user from the Supabase Dashboard.'
    );
  }
}

seed();
