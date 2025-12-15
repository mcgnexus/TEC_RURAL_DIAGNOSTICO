import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Configura SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_SERVICE_ROLE) y NEXT_PUBLIC_SUPABASE_URL.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
