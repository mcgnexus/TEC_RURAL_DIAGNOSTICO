import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppImage, sendWhatsAppText } from '@/lib/whapi';

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

export async function POST(request) {
  try {
    const supabaseAuth = createSupabaseAuthClient();
    const body = await request.json().catch(() => ({}));

    const diagnosisId = body?.diagnosisId || body?.diagnosis_id || null;
    const toPhone = body?.to || body?.phone || null;
    const includeImage = body?.includeImage !== false;

    if (!diagnosisId) {
      return NextResponse.json({ error: 'diagnosisId es obligatorio.' }, { status: 400 });
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
      .select('id, user_id, cultivo_name, image_url, ai_diagnosis_md, created_at')
      .eq('id', diagnosisId)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: 'No se pudo leer el diagnóstico.' }, { status: 500 });
    }

    if (!diagnosis) {
      return NextResponse.json({ error: 'Diagnóstico no encontrado.' }, { status: 404 });
    }

    if (diagnosis.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    let destination = toPhone;
    if (!destination) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        return NextResponse.json({ error: 'No se pudo leer el teléfono del perfil.' }, { status: 500 });
      }

      destination = profile?.phone || null;
    }

    if (!destination) {
      return NextResponse.json(
        { error: 'No hay teléfono destino. Envía `to` o configura `profiles.phone`.' },
        { status: 400 }
      );
    }

    const title = `Diagnóstico TEC Rural – ${diagnosis.cultivo_name || 'Cultivo'}`;
    const text = `${title}\n\n${diagnosis.ai_diagnosis_md || 'Diagnóstico no disponible.'}`;

    if (includeImage && diagnosis.image_url) {
      await sendWhatsAppImage({ to: destination, imageUrl: diagnosis.image_url, caption: title });
    }

    await sendWhatsAppText({ to: destination, text });

    return NextResponse.json({ success: true, to: destination, diagnosisId });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Error inesperado.' }, { status: 500 });
  }
}

