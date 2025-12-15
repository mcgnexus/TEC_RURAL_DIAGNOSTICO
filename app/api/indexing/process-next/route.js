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
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const allowFailed = Boolean(body?.allowFailed);
    const chunkSize = body?.chunkSize;
    const chunkOverlap = body?.chunkOverlap;

    const statuses = allowFailed ? ['pending', 'failed'] : ['pending'];
    let doc = null;

    const { data: claimed, error: claimError } = await supabaseAdmin
      .rpc('claim_next_ingestion_document', { allow_failed: allowFailed })
      .catch(err => ({ data: null, error: err }));

    if (!claimError) {
      doc = Array.isArray(claimed) ? claimed[0] : null;
    } else {
      const isMissingFunction =
        claimError?.code === 'PGRST202' || String(claimError?.message || '').includes('schema cache');

      if (!isMissingFunction) {
        console.error('RPC claim_next_ingestion_document error:', claimError);
        return NextResponse.json(
          {
            error: `RPC claim_next_ingestion_document: ${claimError.message}`,
            code: claimError.code,
            details: claimError.details,
            hint: claimError.hint,
          },
          { status: 500 }
        );
      }

      // Fallback (sin funcion): reclamar por "best effort" via select + update condicional.
      console.warn(
        'RPC claim_next_ingestion_document no disponible (schema cache). Usando fallback select+update.'
      );

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data: nextDocs, error: nextError } = await supabaseAdmin
          .from('ingestion_documents')
          .select('id, status')
          .in('status', statuses)
          .order('created_at', { ascending: true })
          .limit(1);

        if (nextError) {
          return NextResponse.json(
            {
              error: `Fallback claim (select): ${nextError.message}`,
              hint:
                'Aplica supabase/indexing_v2.sql y ejecuta NOTIFY pgrst, \'reload schema\'; para habilitar la cola via RPC.',
            },
            { status: 500 }
          );
        }

        const candidate = nextDocs?.[0];
        if (!candidate) break;

        const { data: updated, error: updateError } = await supabaseAdmin
          .from('ingestion_documents')
          .update({
            status: 'processing',
            error_message: null,
            processed_chunks: 0,
            started_at: new Date().toISOString(),
            finished_at: null,
          })
          .eq('id', candidate.id)
          .in('status', statuses)
          .select('*')
          .maybeSingle();

        if (updateError) {
          return NextResponse.json(
            {
              error: `Fallback claim (update): ${updateError.message}`,
              hint:
                'Aplica supabase/indexing_v2.sql y ejecuta NOTIFY pgrst, \'reload schema\'; para habilitar la cola via RPC.',
            },
            { status: 500 }
          );
        }

        if (updated) {
          doc = updated;
          break;
        }
      }
    }

    if (!doc) {
      return NextResponse.json({ status: 'empty', message: 'No hay documentos pendientes.' }, { status: 200 });
    }

    try {
      const updatedDoc = await processIngestionDocument({
        documentId: doc.id,
        chunkConfig: { chunkSize, chunkOverlap },
      });
      return NextResponse.json({ status: 'ready', document: updatedDoc });
    } catch (processError) {
      console.error('Error procesando documento (queue):', processError);
      await supabaseAdmin
        .from('ingestion_documents')
        .update({
          status: 'failed',
          error_message: processError.message,
          finished_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      return NextResponse.json({ error: processError.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Indexing process-next error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
