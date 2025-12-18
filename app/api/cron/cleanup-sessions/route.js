import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireCronAuth } from '@/lib/auth/middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint de cron job para limpiar sesiones de WhatsApp expiradas
 * Se ejecuta cada 15 minutos mediante Vercel Cron Jobs
 */
export async function GET(request) {
  try {
    // Verificar autenticación del cron job
    const { error, valid } = requireCronAuth(request);
    if (error) return error;

    console.log('[cron-cleanup] Iniciando limpieza de sesiones...');

    // Llamar a la función RPC de Supabase para limpiar sesiones expiradas
    const { data, error: rpcError } = await supabaseAdmin.rpc('cleanup_expired_whatsapp_sessions');

    if (rpcError) {
      console.error('[cron-cleanup] Error ejecutando RPC:', rpcError);
      return NextResponse.json(
        {
          success: false,
          error: rpcError.message,
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
