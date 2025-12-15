import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { processIngestionDocument } from '@/lib/indexing/processIngestionDocument';

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

export async function POST(request) {
  let documentId = null;
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    documentId = body?.documentId?.toString();
    const chunkSize = body?.chunkSize;
    const chunkOverlap = body?.chunkOverlap;
    if (!documentId) {
      return NextResponse.json({ error: 'documentId es requerido.' }, { status: 400 });
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from('ingestion_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 404 });
    }

    if (doc.status === 'ready') {
      return NextResponse.json({ status: 'ready', document: doc });
    }

    const { error: markError } = await supabaseAdmin
      .from('ingestion_documents')
      .update({ status: 'processing', error_message: null, started_at: new Date().toISOString(), processed_chunks: 0 })
      .eq('id', documentId);

    if (markError) {
      return NextResponse.json({ error: markError.message }, { status: 500 });
    }
    const updatedDoc = await processIngestionDocument({ documentId, chunkConfig: { chunkSize, chunkOverlap } });
    return NextResponse.json({ status: 'ready', document: updatedDoc });
  } catch (error) {
    console.error('Indexing process error:', error);
    if (documentId) {
      await supabaseAdmin
        .from('ingestion_documents')
        .update({ status: 'failed', error_message: error.message, finished_at: new Date().toISOString() })
        .eq('id', documentId);
    }

    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
