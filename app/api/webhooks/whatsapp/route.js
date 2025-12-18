import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getActiveSession,
  updateSessionState,
  clearSession,
} from '@/lib/whatsappSession';
import {
  handleNuevoCommand,
  handleHistorialCommand,
  handleCreditosCommand,
  handleAyudaCommand,
  detectCommand,
} from '@/lib/whatsappCommands';
import {
  sendWhatsAppText,
  sendWhatsAppError,
  normalizePhoneFromChatId,
  downloadWhatsAppMedia,
} from '@/lib/whapi';
import { runDiagnosis } from '@/lib/diagnosisEngine';
import { requireWhapiWebhookAuth } from '@/lib/auth/middleware';
import { maskId, maskPhone, redactForLog, redactString } from '@/lib/logging';

export const runtime = 'nodejs';

function extractWhapiMessages(body) {
  if (!body) return [];
  if (Array.isArray(body.messages)) return body.messages;
  if (body.messages && typeof body.messages === 'object') return [body.messages];
  if (body.message && typeof body.message === 'object') return [body.message];
  if (Array.isArray(body.data?.messages)) return body.data.messages;
  return [];
}

function isFromMe(message) {
  const value = message?.from_me ?? message?.fromMe;
  return value === true || value === 1 || value === 'true';
}

function getWhatsAppDedupId(messageId) {
  if (!messageId) return null;
  return `whatsapp:${String(messageId)}`;
}

/**
 * Marca un mensaje como procesado para evitar duplicados
 */
async function markMessageAsProcessed(messageId, phone) {
  const dedupId = getWhatsAppDedupId(messageId);
  if (!dedupId) return;

  try {
    const { error } = await supabaseAdmin
      .from('processed_webhook_messages')
      .insert({
        message_id: dedupId,
        phone: phone || 'unknown',
        processed_at: new Date().toISOString(),
      });

    if (!error) {
      console.log(`[whatsapp-webhook] Mensaje ${dedupId} marcado como procesado`);
      return;
    }

    if (error.code === '23505') {
      console.log(`[whatsapp-webhook] Mensaje ${dedupId} ya estaba marcado como procesado`);
      return;
    }

    console.error('[whatsapp-webhook] Error marcando mensaje como procesado:', redactForLog(error));
  } catch (error) {
    console.error('[whatsapp-webhook] Error en markMessageAsProcessed:', redactForLog(error));
  }
}

/**
 * Endpoint para recibir webhooks de Whapi
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const { error } = requireWhapiWebhookAuth(request, rawBody);
    if (error) return error;

    const body = rawBody ? JSON.parse(rawBody) : {};

    console.log('[whatsapp-webhook] ✅ WEBHOOK RECIBIDO');
    console.log('[whatsapp-webhook] Body:', JSON.stringify(redactForLog(body), null, 2));

    const messages = extractWhapiMessages(body);

    // Validar estructura del webhook
    if (!messages.length) {
      console.log('[whatsapp-webhook] ⚠️ Sin mensajes en el webhook (puede ser una notificación de estado)');
      return NextResponse.json({ success: true, message: 'No messages to process' }, { status: 200 });
    }

    console.log(`[whatsapp-webhook] 📩 Total mensajes recibidos: ${messages.length}`);

    // Procesar solo mensajes entrantes (from_me: false)
    const incomingMessages = messages.filter(msg => !isFromMe(msg));

    console.log(`[whatsapp-webhook] 📥 Mensajes entrantes: ${incomingMessages.length}`);

    for (const message of incomingMessages) {
      // Procesar cada mensaje de forma asíncrona pero secuencial
      await processIncomingMessage(message).catch(err => {
        console.error('[whatsapp-webhook] ❌ Error procesando mensaje:', redactForLog(err));
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[whatsapp-webhook] ❌ Error procesando webhook:', redactForLog(error));
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error interno',
      },
      { status: 500 }
    );
  }
}

/**
 * Endpoint de prueba para verificar que el webhook está funcionando
 * GET /api/webhooks/whatsapp
 */
export async function GET() {
  const checks = {
    WHAPI_TOKEN: !!process.env.WHAPI_TOKEN,
    WHAPI_API_URL: !!process.env.WHAPI_API_URL,
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
  };

  const allConfigured = Object.values(checks).every(Boolean);

  return NextResponse.json({
    status: allConfigured ? 'webhook_active' : 'configuration_error',
    message: allConfigured 
      ? 'El webhook de WhatsApp está activo y funcionando' 
      : 'Faltan variables de entorno críticas',
    checks,
    timestamp: new Date().toISOString()
  }, { status: allConfigured ? 200 : 500 });
}

/**
 * Procesa un mensaje entrante individual
 */
async function processIncomingMessage(message) {
  const chat_id =
    message?.chat_id ||
    message?.chatId ||
    message?.from ||
    message?.sender?.id ||
    '';
  const { type, id: messageId } = message;
  const phone = normalizePhoneFromChatId(chat_id);
  const dedupId = getWhatsAppDedupId(messageId);

  try {
    if (!phone) {
      console.warn('[whatsapp-webhook] No se pudo normalizar el teléfono:', maskPhone(chat_id));
      return;
    }

    // DEDUPLICACIÓN: Verificar si el mensaje ya fue procesado
    if (dedupId) {
      const { data: existing, error } = await supabaseAdmin
        .from('processed_webhook_messages')
        .select('id')
        .eq('message_id', dedupId)
        .maybeSingle();

      if (error) {
        console.error('[whatsapp-webhook] Error verificando deduplicación:', redactForLog(error));
      }

      if (existing) {
        console.log(`[whatsapp-webhook] Mensaje ${dedupId} ya fue procesado, omitiendo...`);
        return;
      }
    }

    console.log(`[whatsapp-webhook] Procesando mensaje de ${maskPhone(phone)}, tipo: ${type}`);

    // 1. AUTENTICACIÓN: Verificar si el usuario está registrado
    const phoneDigits = String(phone).replace(/[^\d]/g, '');
    const phoneCandidates = Array.from(
      new Set([phone, phoneDigits ? `+${phoneDigits}` : null, phoneDigits].filter(Boolean))
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone, credits_remaining')
      .in('phone', phoneCandidates)
      .maybeSingle();

    if (profileError) {
      console.error('[whatsapp-webhook] Error consultando perfil:', profileError);
      await sendWhatsAppError(
        phone,
        'Ocurrió un error al verificar tu cuenta. Por favor intenta más tarde.'
      );
      return;
    }

    if (!profile) {
      console.log(`[whatsapp-webhook] Usuario no registrado: ${maskPhone(phone)}`);
      await sendWhatsAppText({
        to: phone,
        text: 'Tu número no está registrado en TEC Rural Diagnóstico.\n\nPor favor regístrate en la aplicación web primero:\nhttps://tec-rural-diagnostico.vercel.app',
      });
      return;
    }

    const userId = profile.id;
    console.log(`[whatsapp-webhook] Usuario autenticado: ${maskId(userId)}`);

    // 2. DETECCIÓN DE COMANDOS
    if (type === 'text') {
      const command = detectCommand(message.text?.body || '');

      if (command) {
        await handleCommand(command, phone, userId, profile);
        return;
      }
    }

    // 3. DIAGNÓSTICO RÁPIDO: Imagen con caption (texto adjunto)
    if (type === 'image' && message.image?.caption) {
      console.log('[whatsapp-webhook] Imagen con caption detectada, procesando diagnóstico rápido');
      await handleQuickDiagnosis(message, phone, userId, profile);
      return;
    }

    // 4. GESTIÓN DE SESIONES CONVERSACIONALES
    await handleConversationalFlow(message, phone, userId, profile);
  } finally {
    // Siempre marcar el mensaje como procesado al final
    await markMessageAsProcessed(messageId, phone);
  }
}

/**
 * Procesa un diagnóstico rápido desde imagen con caption
 * Formato esperado: "cultivo - síntomas" o solo "cultivo"
 */
async function handleQuickDiagnosis(message, phone, userId, profile) {
  const imageData = message.image;
  const caption = imageData.caption?.trim() || '';

  console.log('[whatsapp-webhook] Caption recibido:', redactString(caption));

  // Verificar créditos
  if (profile.credits_remaining <= 0) {
    await sendWhatsAppError(
      phone,
      'No tienes créditos disponibles. Contacta al administrador para obtener más.'
    );
    return;
  }

  // Parsear caption para extraer cultivo y síntomas
  // Formato: "cultivo - síntomas" o solo "cultivo"
  let cultivoName = '';
  let notes = '';

  if (caption.includes('-')) {
    const parts = caption.split('-').map(p => p.trim());
    cultivoName = parts[0];
    notes = parts.slice(1).join(' - '); // Por si hay múltiples '-'
  } else {
    cultivoName = caption;
  }

  // Validar que al menos tenga el cultivo
  if (!cultivoName || cultivoName.length < 2) {
    await sendWhatsAppText({
      to: phone,
      text: `Para hacer un diagnóstico rápido, envía una imagen con el nombre del cultivo en el texto.\n\n*Ejemplos:*\n• tomate\n• café - hojas amarillas\n• maíz - manchas en tallos\n\nO usa /nuevo para el flujo guiado paso a paso.`,
    });
    return;
  }

  console.log(
    `[whatsapp-webhook] Diagnóstico rápido - Cultivo: ${redactString(cultivoName)}, Notas: ${notes ? redactString(notes) : 'ninguna'}`
  );

  // Obtener URL de la imagen
  const imageUrl = imageData.link || imageData.url || imageData.media_url || imageData.file;

  if (!imageUrl) {
    console.error('[whatsapp-webhook] No se encontró URL de imagen');
    await sendWhatsAppError(phone, 'No se pudo obtener la imagen. Intenta nuevamente.');
    return;
  }

  try {
    await sendWhatsAppText({
      to: phone,
      text: '⏳ Analizando tu imagen... Esto puede tomar unos segundos.',
    });

    // Descargar imagen
    console.log('[whatsapp-webhook] Descargando imagen desde:', redactString(imageUrl));
    const imageBuffer = await downloadWhatsAppMedia(imageUrl);
    const mimeType = imageData.mime_type || imageData.mimetype || 'image/jpeg';

    console.log(`[whatsapp-webhook] Imagen descargada: ${imageBuffer.length} bytes, tipo: ${mimeType}`);

    // Ejecutar diagnóstico
    const diagnosisResult = await runDiagnosis({
      userId,
      cultivoName,
      notes,
      imageBuffer,
      mimeType,
      source: 'whatsapp',
    });

    // Manejar resultado
    if (diagnosisResult.needsBetterPhoto) {
      await sendWhatsAppText({
        to: phone,
        text: `⚠️ ${diagnosisResult.message}\n\nPor favor envía otra foto más clara del cultivo.`,
      });
      return;
    }

    if (diagnosisResult.error) {
      console.error('[whatsapp-webhook] Error en diagnóstico rápido:', redactForLog(diagnosisResult.error));
      await sendWhatsAppError(phone, diagnosisResult.error);
      return;
    }

    // ÉXITO: Enviar diagnóstico
    const diagnosis = diagnosisResult.diagnosis;
    const confidence = diagnosis.confidence_score
      ? Math.round(diagnosis.confidence_score * 100)
      : 0;

    const resultText = `✅ *Diagnóstico completado*\n\n📋 Cultivo: ${diagnosis.cultivo_name}\n🎯 Confianza: ${confidence}%\n\n${diagnosis.ai_diagnosis_md}\n\n💳 Créditos restantes: ${diagnosisResult.remainingCredits}`;

    await sendWhatsAppText({ to: phone, text: resultText });

    console.log(
      `[whatsapp-webhook] Diagnóstico rápido completado para ${maskPhone(phone)}, ID: ${maskId(diagnosis.id)}`
    );
  } catch (error) {
    console.error('[whatsapp-webhook] Error en diagnóstico rápido:', redactForLog(error));
    await sendWhatsAppError(
      phone,
      'Ocurrió un error procesando tu imagen. Por favor intenta nuevamente más tarde.'
    );
  }
}

/**
 * Maneja la ejecución de comandos
 */
async function handleCommand(command, phone, userId, profile) {
  let response;

  try {
    console.log(`[whatsapp-webhook] Ejecutando comando: ${command}`);

    switch (command) {
      case 'nuevo':
        // Verificar créditos antes de iniciar
        if (profile.credits_remaining <= 0) {
          response =
            'No tienes créditos disponibles.\n\nCada diagnóstico consume 1 crédito. Contacta al administrador para obtener más.';
        } else {
          response = await handleNuevoCommand(phone, userId);
        }
        break;

      case 'historial':
        response = await handleHistorialCommand(userId);
        break;

      case 'creditos':
        response = await handleCreditosCommand(userId);
        break;

      case 'ayuda':
        response = await handleAyudaCommand();
        break;

      default:
        response = await handleAyudaCommand();
    }

    await sendWhatsAppText({ to: phone, text: response });
  } catch (error) {
    console.error(`[whatsapp-webhook] Error ejecutando comando ${command}:`, error);
    await sendWhatsAppError(phone, 'Ocurrió un error procesando tu comando. Intenta nuevamente.');
  }
}

/**
 * Maneja el flujo conversacional basado en el estado de la sesión
 */
async function handleConversationalFlow(message, phone, userId, profile) {
  const session = await getActiveSession(phone);

  // Si no hay sesión activa, sugerir /nuevo
  if (!session || session.state === 'idle') {
    const helpText = `Hola! Soy el asistente de diagnóstico de TEC Rural.\n\nEscribe /nuevo para iniciar un diagnóstico o /ayuda para ver todos los comandos.`;
    await sendWhatsAppText({ to: phone, text: helpText });
    return;
  }

  console.log(`[whatsapp-webhook] Sesión activa en estado: ${session.state}`);

  // Máquina de estados
  switch (session.state) {
    case 'awaiting_cultivo':
      await handleCultivoInput(message, phone);
      break;

    case 'awaiting_notes':
      await handleNotesInput(message, phone, userId, profile);
      break;

    case 'awaiting_image':
      await handleImageInput(message, phone, userId, profile);
      break;

    case 'processing':
      await sendWhatsAppText({
        to: phone,
        text: 'Tu diagnóstico está siendo procesado. Por favor espera unos momentos.',
      });
      break;

    default:
      await sendWhatsAppError(phone, 'Estado de sesión desconocido. Escribe /nuevo para comenzar.');
      await clearSession(phone);
  }
}

/**
 * Procesa la entrada del nombre del cultivo
 */
async function handleCultivoInput(message, phone) {
  if (message.type !== 'text' || !message.text?.body) {
    await sendWhatsAppText({
      to: phone,
      text: 'Por favor envía el nombre del cultivo como texto.',
    });
    return;
  }

  const cultivoName = message.text.body.trim();

  if (!cultivoName || cultivoName.length < 2) {
    await sendWhatsAppText({
      to: phone,
      text: 'El nombre del cultivo debe tener al menos 2 caracteres. Intenta nuevamente.',
    });
    return;
  }

  console.log(`[whatsapp-webhook] Cultivo recibido: ${redactString(cultivoName)}`);

  // Guardar cultivo y avanzar al siguiente estado
  await updateSessionState(phone, 'awaiting_notes', { cultivo_name: cultivoName });

  const responseText = `Perfecto! Cultivo: *${cultivoName}*\n\nAhora, describe los síntomas que observas en la planta (opcional).\n\nPuedes escribir "omitir" si prefieres enviar solo la imagen.`;
  await sendWhatsAppText({ to: phone, text: responseText });
}

/**
 * Procesa la entrada de notas/síntomas
 */
async function handleNotesInput(message, phone, userId, profile) {
  let notes = '';

  // Aceptar texto o permitir imagen directa
  if (message.type === 'text') {
    const input = message.text?.body?.trim().toLowerCase();

    if (input === 'omitir' || input === 'skip' || input === 'no') {
      notes = '';
    } else {
      notes = message.text?.body?.trim() || '';
    }

    console.log(`[whatsapp-webhook] Notas recibidas: ${notes ? notes.substring(0, 50) + '...' : 'omitir'}`);

    // Guardar notas y avanzar
    await updateSessionState(phone, 'awaiting_image', { notes });

    const responseText = `Entendido.\n\nAhora envía una foto clara de la planta mostrando los síntomas.`;
    await sendWhatsAppText({ to: phone, text: responseText });
  } else if (message.type === 'image') {
    // Usuario envió imagen directamente, procesar sin notas
    console.log('[whatsapp-webhook] Usuario envió imagen directamente, omitiendo notas');

    // Actualizar sesión para guardar notas vacías, luego procesar imagen inmediatamente
    await updateSessionState(phone, 'awaiting_image', { notes: '' });

    // Procesar la imagen sin esperar otra entrada
    await handleImageInput(message, phone, userId, profile);
  } else {
    await sendWhatsAppText({
      to: phone,
      text: 'Por favor envía texto con los síntomas, escribe "omitir", o envía directamente la imagen.',
    });
  }
}

/**
 * Procesa la imagen y ejecuta el diagnóstico
 */
async function handleImageInput(message, phone, userId, profile) {
  if (message.type !== 'image') {
    await sendWhatsAppText({
      to: phone,
      text: 'Por favor envía una imagen de la planta.',
    });
    return;
  }

  // Log completo del mensaje para debugging
  console.log('[whatsapp-webhook] Mensaje completo recibido:', JSON.stringify(redactForLog(message), null, 2));

  const imageData = message.image;

  if (!imageData) {
    console.error('[whatsapp-webhook] No hay objeto image en el mensaje');
    await sendWhatsAppError(phone, 'No se pudo obtener la imagen. Intenta nuevamente.');
    return;
  }

  console.log('[whatsapp-webhook] imageData:', JSON.stringify(redactForLog(imageData), null, 2));

  // Intentar diferentes campos donde podría estar la URL
  const imageUrl = imageData.link || imageData.url || imageData.media_url || imageData.file;

  if (!imageUrl) {
    console.error('[whatsapp-webhook] No se encontró URL de imagen. Campos disponibles:', Object.keys(imageData));
    await sendWhatsAppError(phone, 'No se pudo obtener la URL de la imagen. Intenta nuevamente.');
    return;
  }

  console.log('[whatsapp-webhook] URL de imagen encontrada:', redactString(imageUrl));

  try {
    console.log(`[whatsapp-webhook] Procesando imagen: ${redactString(imageUrl)}`);

    // Verificar créditos nuevamente antes de procesar
    if (profile && profile.credits_remaining <= 0) {
      await sendWhatsAppError(
        phone,
        'No tienes créditos disponibles para crear un diagnóstico. Contacta al administrador.'
      );
      await clearSession(phone);
      return;
    }

    // Actualizar estado a procesando
    await updateSessionState(phone, 'processing', {});

    await sendWhatsAppText({
      to: phone,
      text: '⏳ Procesando tu imagen... Esto puede tomar unos segundos.',
    });

    // Descargar imagen
    console.log('[whatsapp-webhook] Intentando descargar imagen desde:', redactString(imageUrl));
    const imageBuffer = await downloadWhatsAppMedia(imageUrl);
    const mimeType = imageData.mime_type || imageData.mimetype || 'image/jpeg';
    console.log('[whatsapp-webhook] Imagen descargada exitosamente:', imageBuffer.length, 'bytes');

    console.log(`[whatsapp-webhook] Imagen descargada: ${imageBuffer.length} bytes, tipo: ${mimeType}`);

    // Obtener datos de la sesión actualizada
    const currentSession = await getActiveSession(phone);

    if (!currentSession) {
      await sendWhatsAppError(phone, 'Tu sesión expiró. Escribe /nuevo para iniciar nuevamente.');
      return;
    }

    // Ejecutar diagnóstico
    const diagnosisResult = await runDiagnosis({
      userId,
      cultivoName: currentSession.cultivo_name,
      notes: currentSession.notes || '',
      imageBuffer,
      mimeType,
      source: 'whatsapp',
    });

    // Manejar resultado
    if (diagnosisResult.needsBetterPhoto) {
      await sendWhatsAppText({
        to: phone,
        text: `⚠️ ${diagnosisResult.message}\n\nPor favor envía otra foto más clara mostrando los síntomas.`,
      });
      // Volver al estado de espera de imagen
      await updateSessionState(phone, 'awaiting_image', {});
      return;
    }

    if (diagnosisResult.error) {
      console.error('[whatsapp-webhook] Error en diagnóstico:', redactForLog(diagnosisResult.error));
      await sendWhatsAppError(phone, diagnosisResult.error);
      await clearSession(phone);
      return;
    }

    // ÉXITO: Enviar diagnóstico
    const diagnosis = diagnosisResult.diagnosis;
    const confidence = diagnosis.confidence_score
      ? Math.round(diagnosis.confidence_score * 100)
      : 0;

    const resultText = `✅ *Diagnóstico completado*\n\n📋 Cultivo: ${diagnosis.cultivo_name}\n🎯 Confianza: ${confidence}%\n\n${diagnosis.ai_diagnosis_md}\n\n💳 Créditos restantes: ${diagnosisResult.remainingCredits}`;

    await sendWhatsAppText({ to: phone, text: resultText });

    // Limpiar sesión
    await clearSession(phone);

    console.log(`[whatsapp-webhook] Diagnóstico completado para ${maskPhone(phone)}, ID: ${maskId(diagnosis.id)}`);
  } catch (error) {
    console.error('[whatsapp-webhook] Error procesando imagen:', redactForLog(error));
    await sendWhatsAppError(
      phone,
      'Ocurrió un error procesando tu imagen. Por favor intenta nuevamente más tarde.'
    );
    await clearSession(phone);
  }
}
