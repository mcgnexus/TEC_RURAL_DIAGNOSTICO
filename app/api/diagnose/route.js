import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { runDiagnosis } from '@/lib/diagnosisEngine';

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

export async function POST(request) {
  try {
    const supabaseAuth = createSupabaseAuthClient();
    const formData = await request.formData();

    const cultivoName = formData.get('cultivoName')?.toString().trim() || '';
    const notes = formData.get('notes')?.toString().trim() || '';
    const gpsLat = formData.get('gpsLat');
    const gpsLong = formData.get('gpsLong');
    const image = formData.get('image');

    if (!cultivoName) {
      return NextResponse.json({ error: 'El nombre del cultivo es obligatorio.' }, { status: 400 });
    }

    if (!image || typeof image === 'string') {
      return NextResponse.json({ error: 'Se requiere una imagen para el diagnóstico.' }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const mimeType = image.type || 'image/jpeg';

    const diagnosisResult = await runDiagnosis({
      userId: user.id,
      cultivoName,
      notes,
      gpsLat,
      gpsLong,
      imageBuffer,
      mimeType,
      source: 'web',
    });

    if (diagnosisResult.needsBetterPhoto) {
      return NextResponse.json(
        {
          needsBetterPhoto: true,
          message:
            diagnosisResult.message ||
            'La imagen no fue concluyente. Por favor toma otra foto más clara.',
        },
        { status: 200 }
      );
    }

    if (diagnosisResult.error) {
      return NextResponse.json(
        { error: diagnosisResult.error },
        { status: diagnosisResult.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      diagnosis: diagnosisResult.diagnosis,
      remainingCredits: diagnosisResult.remainingCredits,
      recommendations: diagnosisResult.recommendations || [],
    });
  } catch (error) {
    console.error('Diagnose API error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
