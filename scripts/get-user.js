import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsers() {
  const { data: users, error } = await supabase.from('profiles').select('id, phone').limit(1);
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Usuario encontrado:', users[0]);
}

checkUsers();