// One-shot script: updates worksite_settings with the office coordinates
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../frontend/.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const OFFICE_LAT = 22.99299568503188;
const OFFICE_LNG = 72.49925448220175;

async function run() {
  // Try to get existing row
  const { data: existing } = await supabase.from('worksite_settings').select('id').limit(1).single();

  let result;
  if (existing?.id) {
    result = await supabase
      .from('worksite_settings')
      .update({ site_lat: OFFICE_LAT, site_lng: OFFICE_LNG })
      .eq('id', existing.id)
      .select()
      .single();
    console.log('Updated existing worksite_settings row:', result.data);
  } else {
    result = await supabase
      .from('worksite_settings')
      .insert([{ site_lat: OFFICE_LAT, site_lng: OFFICE_LNG, radius_meters: 150, default_daily_wage: 500 }])
      .select()
      .single();
    console.log('Inserted new worksite_settings row:', result.data);
  }

  if (result.error) {
    console.error('Error:', result.error.message);
    process.exit(1);
  }

  console.log('✅ Done — office coordinates set to', OFFICE_LAT, OFFICE_LNG);
}

run();
