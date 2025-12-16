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
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set({ name, value, ...options })
        );
      },
    },
  });
};

export async function DELETE(request, { params }) {
  try {
    const supabaseAuth = createSupabaseAuthClient();
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID de diagnóstico requerido.' }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { data: diagnosis, error: readError } = await supabaseAdmin
      .from('diagnoses')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: 'No se pudo validar el diagnóstico.' }, { status: 500 });
    }

    if (!diagnosis) {
      return NextResponse.json({ error: 'Diagnóstico no encontrado.' }, { status: 404 });
    }

    if (diagnosis.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('diagnoses')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: 'No se pudo borrar el diagnóstico.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Error inesperado.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabaseAuth = createSupabaseAuthClient();
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID de diagnóstico requerido.' }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { data: diagnosis, error: readError } = await supabaseAdmin
      .from('diagnoses')
      .select('id, user_id, is_confirmed, confirmation_source, status')
      .eq('id', id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: 'No se pudo validar el diagnóstico.' }, { status: 500 });
    }

    if (!diagnosis) {
      return NextResponse.json({ error: 'Diagnóstico no encontrado.' }, { status: 404 });
    }

    if (diagnosis.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedSource = body?.confirmationSource || body?.confirmation_source || null;
    const confirmationSource =
      diagnosis.confirmation_source || (requestedSource ? String(requestedSource) : null) || 'usuario';

    if (diagnosis.is_confirmed) {
      return NextResponse.json({
        success: true,
        diagnosis: {
          id: diagnosis.id,
          status: diagnosis.status,
          is_confirmed: true,
          confirmation_source: diagnosis.confirmation_source || confirmationSource,
        },
      });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('diagnoses')
      .update({ is_confirmed: true, confirmation_source: confirmationSource })
      .eq('id', id)
      .select('id, status, is_confirmed, confirmation_source')
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'No se pudo confirmar el diagnóstico.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, diagnosis: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Error inesperado.' },
      { status: 500 }
    );
  }
}
