import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function timingSafeEqualStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function normalizeSignature(signature) {
  if (!signature || typeof signature !== 'string') return null;
  return signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;
}

function computeHmacSha256(rawBody, secret, digestEncoding) {
  return createHmac('sha256', secret).update(rawBody).digest(digestEncoding);
}

/**
 * Middleware de autenticación para endpoints de administración
 * Verifica que el usuario tenga un rol adecuado
 */
export async function requireAdminAuth(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    return {
      error: NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 }),
      user: null
    };
  }

  // Crear cliente anon para verificar el token (solo para verificación del token)
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  // Obtener token del header Authorization
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }),
      user: null
    };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verificar el token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return {
        error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }),
        user: null
      };
    }

    // Verificar que el usuario tenga rol de admin - usar cliente admin para evitar problemas de permisos
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('Verificación de admin:', { userId: user.id, profileRole: profile?.role, profileError });

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('Acceso denegado - Razón:', { 
        profileError, 
        hasProfile: !!profile, 
        profileRole: profile?.role,
        expectedRole: 'admin'
      });
      return {
        error: NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 }),
        user: null
      };
    }

    return { error: null, user };
  } catch (error) {
    console.error('Error en autenticación:', error);
    return {
      error: NextResponse.json({ error: 'Error de autenticación' }, { status: 500 }),
      user: null
    };
  }
}

/**
 * Middleware para endpoints de cron jobs
 * Verifica el secreto de cron
 */
export function requireCronAuth(request) {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    return {
      error: NextResponse.json({ error: 'Cron secret no configurado' }, { status: 500 }),
      valid: false
    };
  }

  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
      valid: false
    };
  }

  return { error: null, valid: true };
}

/**
 * Middleware para endpoints de setup RAG
 * Verifica que el usuario sea admin o tenga un token especial
 */
export async function requireSetupAuth(request) {
  const setupToken = process.env.SETUP_RAG_TOKEN;
  const authHeader = request.headers.get('authorization');
  
  // Si hay un token de setup configurado, verificarlo
  if (setupToken) {
    if (authHeader === `Bearer ${setupToken}`) {
      return { error: null, valid: true };
    }
  }
  
  // Si no hay token de setup, requerir autenticación de admin
  return await requireAdminAuth(request);
}

export function requireTelegramWebhookAuth(request) {
  const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    return { error: null, valid: true };
  }

  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!incomingSecret || !timingSafeEqualStrings(incomingSecret, webhookSecret)) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
      valid: false,
    };
  }

  return { error: null, valid: true };
}

export function requireWhapiWebhookAuth(request, rawBody) {
  const secret = (process.env.WHAPI_WEBHOOK_SECRET || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  console.log('[whapi-auth] 🔐 Verificando autenticación webhook');
  console.log('[whapi-auth] WHAPI_WEBHOOK_SECRET configurado:', !!secret);
  console.log('[whapi-auth] Modo producción:', isProd);

  if (!secret) {
    console.log('[whapi-auth] ⚠️ Webhook secret no configurado. La autenticación está desactivada.');
    return { error: null, valid: true };
  }

  const signatureHeader =
    request.headers.get('x-whapi-signature') ||
    request.headers.get('x-webhook-signature') ||
    request.headers.get('x-hook-signature') ||
    request.headers.get('x-signature');

  console.log('[whapi-auth] 📋 Headers recibidos:');
  console.log('[whapi-auth] x-whapi-signature:', request.headers.get('x-whapi-signature'));
  console.log('[whapi-auth] x-webhook-signature:', request.headers.get('x-webhook-signature'));
  console.log('[whapi-auth] x-hook-signature:', request.headers.get('x-hook-signature'));
  console.log('[whapi-auth] x-signature:', request.headers.get('x-signature'));
  console.log('[whapi-auth] x-whapi-webhook-secret:', request.headers.get('x-whapi-webhook-secret'));
  console.log('[whapi-auth] x-webhook-secret:', request.headers.get('x-webhook-secret'));
  console.log('[whapi-auth] x-webhook-token:', request.headers.get('x-webhook-token'));

  if (signatureHeader) {
    const normalized = normalizeSignature(signatureHeader);
    if (!normalized) {
      return {
        error: NextResponse.json({ error: 'Firma inválida' }, { status: 401 }),
        valid: false,
      };
    }

    const bodyText = typeof rawBody === 'string' ? rawBody : '';

    const isHex = /^[a-f0-9]{64}$/i.test(normalized);
    const expected = isHex
      ? computeHmacSha256(bodyText, secret, 'hex')
      : computeHmacSha256(bodyText, secret, 'base64');

    const ok = timingSafeEqualStrings(normalized, expected);
    if (!ok) {
      return {
        error: NextResponse.json({ error: 'Firma inválida' }, { status: 401 }),
        valid: false,
      };
    }

    return { error: null, valid: true };
  }

  const secretHeader =
    request.headers.get('x-whapi-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    request.headers.get('x-webhook-token');

  if (!secretHeader || !timingSafeEqualStrings(secretHeader, secret)) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
      valid: false,
    };
  }

  return { error: null, valid: true };
}
