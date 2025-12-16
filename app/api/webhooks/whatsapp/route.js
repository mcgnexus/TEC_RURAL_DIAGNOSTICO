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

export const runtime = 'nodejs';

/**
 * Endpoint para recibir webhooks de Whapi
 */
export async function POST(request) {
  try {
    const body = await request.json();

    console.log('[whatsapp-webhook] Webhook recibido:', JSON.stringify(body, null, 2));

    // Validar estructura del webhook
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ success: true, message: 'No messages to process' }, { status: 200 });
    }

    // Procesar solo mensajes entrantes (from_me: false)
    const incomingMessages = body.messages.filter(msg => !msg.from_me);

    for (const message of incomingMessages) {
      // Procesar cada mensaje de forma asíncrona pero secuencial
      await processIncomingMessage(message).catch(err => {
        console.error('[whatsapp-webhook] Error procesando mensaje:', err);
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[whatsapp-webhook] Error procesando webhook:', error);
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
 * Procesa un mensaje entrante individual
 */
async function processIncomingMessage(message) {
  const { chat_id, type } = message;
  const phone = normalizePhoneFromChatId(chat_id);

  if (!phone) {
    console.warn('[whatsapp-webhook] No se pudo normalizar el teléfono:', chat_id);
    return;
  }

  console.log(`[whatsapp-webhook] Procesando mensaje de ${phone}, tipo: ${type}`);

  // 1. AUTENTICACIÓN: Verificar si el usuario está registrado
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, phone, credits_remaining')
    .eq('phone', phone)
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
    console.log(`[whatsapp-webhook] Usuario no registrado: ${phone}`);
    await sendWhatsAppText({
      to: phone,
      text: 'Tu número no está registrado en TEC Rural Diagnóstico.\n\nPor favor regístrate en la aplicación web primero:\nhttps://tec-rural-diagnostico.vercel.app',
    });
    return;
  }

  const userId = profile.id;
  console.log(`[whatsapp-webhook] Usuario autenticado: ${userId}`);

  // 2. DETECCIÓN DE COMANDOS
  if (type === 'text') {
    const command = detectCommand(message.text?.body || '');

    if (command) {
      await handleCommand(command, phone, userId, profile);
      return;
    }
  }

  // 3. GESTIÓN DE SESIONES CONVERSACIONALES
  await handleConversationalFlow(message, phone, userId, profile);
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
      await handleNotesInput(message, phone);
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

  console.log(`[whatsapp-webhook] Cultivo recibido: ${cultivoName}`);

  // Guardar cultivo y avanzar al siguiente estado
  await updateSessionState(phone, 'awaiting_notes', { cultivo_name: cultivoName });

  const responseText = `Perfecto! Cultivo: *${cultivoName}*\n\nAhora, describe los síntomas que observas en la planta (opcional).\n\nPuedes escribir "omitir" si prefieres enviar solo la imagen.`;
  await sendWhatsAppText({ to: phone, text: responseText });
}

/**
 * Procesa la entrada de notas/síntomas
 */
async function handleNotesInput(message, phone) {
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
    await updateSessionState(phone, 'awaiting_image', { notes: '' });
    // Nota: En este punto no tenemos userId ni profile, necesitamos obtenerlos
    return;
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

  const imageData = message.image;

  if (!imageData?.link) {
    await sendWhatsAppError(phone, 'No se pudo obtener la imagen. Intenta nuevamente.');
    return;
  }

  try {
    console.log(`[whatsapp-webhook] Procesando imagen: ${imageData.link}`);

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
    const imageBuffer = await downloadWhatsAppMedia(imageData.link);
    const mimeType = imageData.mime_type || 'image/jpeg';

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
      console.error('[whatsapp-webhook] Error en diagnóstico:', diagnosisResult.error);
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

    console.log(`[whatsapp-webhook] Diagnóstico completado para ${phone}, ID: ${diagnosis.id}`);
  } catch (error) {
    console.error('[whatsapp-webhook] Error procesando imagen:', error);
    await sendWhatsAppError(
      phone,
      'Ocurrió un error procesando tu imagen. Por favor intenta nuevamente más tarde.'
    );
    await clearSession(phone);
  }
}
