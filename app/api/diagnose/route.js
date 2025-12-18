import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { runDiagnosis } from '@/lib/diagnosisEngine';
import { sendWhatsAppText, sendWhatsAppImage } from '@/lib/whapi';

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

    // NOTIFICACIÓN AUTOMÁTICA POR WHATSAPP (no bloqueante)
    // TEMPORALMENTE DESHABILITADA - INVESTIGAR BUCLE DE NOTIFICACIONES
    if (diagnosisResult.diagnosis) {
      // Ejecutar notificación de forma asíncrona sin bloquear la respuesta
      (async () => {
        try {
          // Obtener teléfono y preferencias de notificación del usuario
          const { data: profile } = await supabaseAuth
            .from('profiles')
            .select('phone, notify_whatsapp_on_diagnosis')
            .eq('id', user.id)
            .maybeSingle();

          // Solo enviar notificación si:
          // 1. El usuario tiene teléfono registrado
          // 2. Las notificaciones de WhatsApp están habilitadas (por defecto true)
          // 3. El diagnóstico no fue notificado recientemente (prevenir duplicados)

          const diagnosis = diagnosisResult.diagnosis;

          // Solo enviar notificación automática si el diagnóstico se creó en esta misma solicitud
          // (es decir, es muy reciente, no más de 10 segundos)
          const NOTIFICATION_FRESHNESS = 10 * 1000; // 10 segundos en ms
          const timeSinceDiagnosis = Date.now() - new Date(diagnosis.created_at).getTime();

          if (profile?.phone && profile?.notify_whatsapp_on_diagnosis !== false && timeSinceDiagnosis < NOTIFICATION_FRESHNESS) {
            const confidence = diagnosis.confidence_score
              ? Math.round(diagnosis.confidence_score * 100)
              : 0;

            const notificationText = `✅ *Diagnóstico completado*\n\n📋 Cultivo: ${diagnosis.cultivo_name}\n🎯 Confianza: ${confidence}%\n\n${diagnosis.ai_diagnosis_md}\n\n💳 Créditos restantes: ${diagnosisResult.remainingCredits}`;

            // Enviar notificación de texto
            await sendWhatsAppText({
              to: profile.phone,
              text: notificationText,
            });

            // Opcionalmente enviar imagen
            if (diagnosis.image_url) {
              await sendWhatsAppImage({
                to: profile.phone,
                imageUrl: diagnosis.image_url,
                caption: `Diagnóstico TEC Rural - ${diagnosis.cultivo_name}`,
              });
            }

            console.log('[diagnose] Notificación WhatsApp enviada a:', profile.phone, `(diagnóstico creado hace ${Math.round(timeSinceDiagnosis / 1000)}s)`);
          } else if (profile?.phone && profile?.notify_whatsapp_on_diagnosis === false) {
            console.log('[diagnose] Notificación WhatsApp omitida: usuario deshabilitó notificaciones');
          } else if (timeSinceDiagnosis >= NOTIFICATION_FRESHNESS) {
            console.log('[diagnose] Notificación WhatsApp omitida: diagnóstico antiguo (más de 10s)');
          } else {
            console.log('[diagnose] No se envió notificación WhatsApp: usuario sin teléfono registrado');
          }
        } catch (notifError) {
          // Log pero no fallar el diagnóstico
          console.error('[diagnose] Error en notificación WhatsApp:', notifError);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      diagnosis: diagnosisResult.diagnosis,
      remainingCredits: diagnosisResult.remainingCredits,
      recommendations: diagnosisResult.recommendations || [],
      ragUsage: diagnosisResult.ragUsage || null,
    });
  } catch (error) {
    console.error('Diagnose API error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
