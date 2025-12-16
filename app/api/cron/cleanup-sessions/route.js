import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * Endpoint de cron job para limpiar sesiones de WhatsApp expiradas
 * Se ejecuta cada 15 minutos mediante Vercel Cron Jobs
 */
export async function GET(request) {
  try {
    // Verificar autenticación del cron job
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[cron-cleanup] CRON_SECRET no configurado');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[cron-cleanup] Intento de acceso no autorizado');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[cron-cleanup] Iniciando limpieza de sesiones...');

    // Llamar a la función RPC de Supabase para limpiar sesiones expiradas
    const { data, error } = await supabaseAdmin.rpc('cleanup_expired_whatsapp_sessions');

    if (error) {
      console.error('[cron-cleanup] Error ejecutando RPC:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const cleanedCount = data || 0;
    console.log(`[cron-cleanup] Limpiadas ${cleanedCount} sesiones expiradas`);

    return NextResponse.json({
      success: true,
      cleaned: cleanedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron-cleanup] Error inesperado:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
