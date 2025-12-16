import { createBrowserClient } from '@supabase/ssr';

let cachedClient = null;

export const getSupabaseBrowser = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tus variables de entorno.'
    );
  }

  if (!cachedClient) {
    cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return cachedClient;
};

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      return getSupabaseBrowser()[prop];
    },
  }
);
