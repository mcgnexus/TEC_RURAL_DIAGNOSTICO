import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTelegramMessage } from '@/lib/telegram/telegramApi';

export const runtime = 'nodejs';

/**
 * Genera un token único para vincular cuenta Telegram con la cuenta web
 *
 * POST /api/telegram/generate-link-token
 * Requiere: usuario autenticado
 * Retorna: { token, expires_in_seconds, bot_username, instructions }
 */
export async function POST(request) {
  try {
    // Obtener usuario autenticado
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
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
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, telegram_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Error al obtener perfil' },
        { status: 500 }
      );
    }

    // Si ya está vinculado, no generar nuevo token
    if (profile?.telegram_id) {
      return NextResponse.json(
        {
          error: 'Tu cuenta ya está vinculada a Telegram',
          telegram_id: profile.telegram_id
        },
        { status: 400 }
      );
    }

    // Generar token único de 6 caracteres
    const token = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    const expiresInSeconds = 15 * 60; // 15 minutos

    // Guardar token en BD
    const { data: linkToken, error: tokenError } = await supabaseAdmin
      .from('telegram_link_tokens')
      .insert({
        token,
        user_id: user.id,
        telegram_id: null, // Se rellena cuando el bot lo valida
        expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        used: false,
      })
      .select()
      .single();

    if (tokenError) {
      console.error('[telegram-link] Error creando token:', tokenError);
      return NextResponse.json(
        { error: 'Error generando token' },
        { status: 500 }
      );
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'TEC_Rural_Bot';

    console.log(`[telegram-link] Token generado para usuario ${user.id}: ${token}`);

    return NextResponse.json({
      success: true,
      token,
      expires_in_seconds: expiresInSeconds,
      bot_username: botUsername,
      instructions: `1. Abre Telegram o ve a @${botUsername}\n2. Envía el comando: /link ${token}\n3. ¡Listo! Tu cuenta estará vinculada`,
      bot_link: `https://t.me/${botUsername}`,
      qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://t.me/${botUsername}?start=${token}`,
    });
  } catch (error) {
    console.error('[telegram-link] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Obtiene el estado de vinculación de Telegram del usuario
 *
 * GET /api/telegram/generate-link-token
 * Requiere: usuario autenticado
 * Retorna: { linked, telegram_id, telegram_username }
 */
export async function GET(request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
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
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('telegram_id, telegram_username')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      linked: !!profile?.telegram_id,
      telegram_id: profile?.telegram_id || null,
      telegram_username: profile?.telegram_username || null,
    });
  } catch (error) {
    console.error('[telegram-link] Error en GET:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Desvincular cuenta Telegram del perfil
 *
 * DELETE /api/telegram/generate-link-token
 * Requiere: usuario autenticado
 */
export async function DELETE(request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
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
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Desvincular Telegram del perfil
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        telegram_id: null,
        telegram_username: null,
      })
      .eq('id', user.id);

    if (error) {
      console.error('[telegram-link] Error desvinculando:', error);
      return NextResponse.json(
        { error: 'Error al desvincular Telegram' },
        { status: 500 }
      );
    }

    console.log(`[telegram-link] Cuenta Telegram desvinculada para usuario ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Cuenta Telegram desvinculada correctamente',
    });
  } catch (error) {
    console.error('[telegram-link] Error en DELETE:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
