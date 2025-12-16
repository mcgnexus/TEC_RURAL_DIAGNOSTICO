import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import crypto from 'crypto';
import { runDiagnosis } from '@/lib/diagnosisEngine';

export const runtime = 'nodejs';

const isDebugEnabled = () =>
  process.env.DIAGNOSE_DEBUG === '1' || process.env.NEXT_PUBLIC_DIAGNOSE_DEBUG === '1';

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'Method Not Allowed',
      message:
        'Este endpoint solo acepta POST (multipart/form-data). Abre la UI de /dashboard/nueva-consulta o envía un POST con cultivoName, notes (opcional) e image.',
      requiredFields: ['cultivoName', 'image'],
      optionalFields: ['notes', 'gpsLat', 'gpsLong'],
    },
    { status: 405 }
  );
}

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
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const supabaseAuth = createSupabaseAuthClient();
    const formData = await request.formData();

    const cultivoName = formData.get('cultivoName')?.toString().trim() || '';
    const notes = formData.get('notes')?.toString().trim() || '';
    const gpsLat = formData.get('gpsLat');
    const gpsLong = formData.get('gpsLong');
    const image = formData.get('image');

    if (!cultivoName) {
      return NextResponse.json(
        { error: 'El nombre del cultivo es obligatorio.', requestId },
        { status: 400, headers: { 'x-diagnose-request-id': requestId } }
      );
    }

    if (!image || typeof image === 'string') {
      return NextResponse.json(
        { error: 'Se requiere una imagen para el diagnóstico.', requestId },
        { status: 400, headers: { 'x-diagnose-request-id': requestId } }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado.', requestId },
        { status: 401, headers: { 'x-diagnose-request-id': requestId } }
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const mimeType = image.type || 'image/jpeg';

    if (isDebugEnabled()) {
      console.log('[diagnose] request', {
        requestId,
        userId: user.id,
        cultivoName,
        notesChars: notes.length,
        mimeType,
        imageBytes: imageBuffer.length,
        gpsLat: gpsLat ? String(gpsLat) : null,
        gpsLong: gpsLong ? String(gpsLong) : null,
      });
    }

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
          requestId,
          message:
            diagnosisResult.message ||
            'La imagen no fue concluyente. Por favor toma otra foto más clara.',
        },
        { status: 200, headers: { 'x-diagnose-request-id': requestId } }
      );
    }

    if (diagnosisResult.error) {
      if (isDebugEnabled()) {
        console.error('[diagnose] runDiagnosis error', {
          requestId,
          statusCode: diagnosisResult.statusCode || 400,
          error: diagnosisResult.error,
          elapsedMs: Date.now() - startedAt,
        });
      }

      return NextResponse.json(
        { error: diagnosisResult.error, requestId },
        { status: diagnosisResult.statusCode || 400, headers: { 'x-diagnose-request-id': requestId } }
      );
    }

    if (isDebugEnabled()) {
      console.log('[diagnose] success', { requestId, elapsedMs: Date.now() - startedAt });
    }

    return NextResponse.json(
      {
        success: true,
        requestId,
        diagnosis: diagnosisResult.diagnosis,
        remainingCredits: diagnosisResult.remainingCredits,
        recommendations: diagnosisResult.recommendations || [],
        ragUsage: diagnosisResult.ragUsage || null,
      },
      { headers: { 'x-diagnose-request-id': requestId } }
    );
  } catch (error) {
    console.error('[diagnose] API error', {
      requestId,
      message: error?.message,
      stack: error?.stack,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { error: error?.message || 'Error inesperado.', requestId },
      { status: 500, headers: { 'x-diagnose-request-id': requestId } }
    );
  }
}
