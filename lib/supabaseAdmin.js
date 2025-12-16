import { createClient } from '@supabase/supabase-js';

let cachedClient = null;

export const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Configura SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_SERVICE_ROLE) y NEXT_PUBLIC_SUPABASE_URL.'
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return cachedClient;
};

export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      return getSupabaseAdmin()[prop];
    },
  }
);
