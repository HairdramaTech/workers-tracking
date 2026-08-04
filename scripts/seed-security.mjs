/**
 * Seed Security Account
 * ---------------------
 * Creates a Supabase Auth account for the security guard role.
 *
 * BEFORE running:
 *   Go to Supabase Dashboard → Authentication → Providers → Email
 *   Disable "Confirm email" (toggle OFF), then run:
 *     node scripts/seed-security.mjs   (from the project root)
 *
 * Security credentials:
 *   Email   : security@admin.com
 *   Password: security123
 *   Role    : security  (stored in user_metadata)
 *
 * After running, if login is still blocked, confirm the account:
 *   UPDATE auth.users
 *   SET email_confirmed_at = now()
 *   WHERE email = 'security@admin.com';
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://lmxxtdwwoiysrxtcipcf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxteHh0ZHd3b2l5c3J4dGNpcGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjQxNzIsImV4cCI6MjEwMTQwMDE3Mn0.g3FrrAGBHWoEYztBHRJCXnglhGZT87sSje-5XMItgTY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log('Creating security account…');

  const { data, error } = await supabase.auth.signUp({
    email: 'security@admin.com',
    password: 'security123',
    options: {
      data: { role: 'security' },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('✅ Security account already exists — nothing to do.');
    } else {
      console.error('❌ Error:', error.message);
      console.log(
        '\nAlternative: create manually in Supabase Dashboard → Authentication → Users → Add User\n',
        '  Email   : security@admin.com\n',
        '  Password: security123\n',
        '\nThen run this SQL to set the role metadata:\n',
        `UPDATE auth.users SET raw_user_meta_data = '{"role":"security"}' WHERE email = 'security@admin.com';`
      );
    }
    return;
  }

  if (data?.user) {
    console.log('✅ Security account created:', data.user.email);
    console.log('   Login: security@admin.com / security123');
    console.log('\n⚠️  If email confirmation is required, run this SQL in Supabase SQL Editor:');
    console.log(`   UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'security@admin.com';`);
  } else {
    console.log('⚠️  Account may need email confirmation. Run the SQL above to confirm it.');
  }
}

seed();
