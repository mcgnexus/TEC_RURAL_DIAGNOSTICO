import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const createSupabaseAuthClient = () => {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });
};

async function requireAdmin() {
  const supabaseAuth = createSupabaseAuthClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'No autorizado.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { error: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores.' }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { data, error: dbError } = await supabaseAdmin
      .from('ingestion_documents')
      .select(
        'id, original_name, mime_type, size_bytes, status, error_message, total_chunks, processed_chunks, created_at, updated_at, started_at, finished_at'
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ documents: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}

