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

export async function DELETE(_request, { params }) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const id = params?.id?.toString();
    if (!id) return NextResponse.json({ error: 'id requerido.' }, { status: 400 });

    const { data: doc, error: docError } = await supabaseAdmin
      .from('ingestion_documents')
      .select('id, storage_bucket, storage_path')
      .eq('id', id)
      .single();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 404 });
    }

    const storageDelete = await supabaseAdmin.storage.from(doc.storage_bucket).remove([doc.storage_path]);
    if (storageDelete.error) {
      // No bloquea el borrado de BD, pero lo reporta.
      console.warn('No se pudo borrar archivo de Storage:', storageDelete.error.message);
    }

    const { error: dbError } = await supabaseAdmin.from('ingestion_documents').delete().eq('id', id);
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}

