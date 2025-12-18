import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { runDiagnosis } from '@/lib/diagnosisEngine';
import { findUserByTelegramId } from '@/lib/telegram/telegramAuth';
import {
  getActiveSession,
  updateSessionState,
  clearSession,
} from '@/lib/telegram/telegramSession';
import {
  handleNuevoCommand,
  handleHistorialCommand,
  handleCreditosCommand,
  handleAyudaCommand,
  detectCommand,
  showStartMenu,
} from '@/lib/telegram/telegramCommands';
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  downloadTelegramFile,
} from '@/lib/telegram/telegramApi';

export const runtime = 'nodejs';

const TELEGRAM_SOURCE = 'telegram';

async function markMessageAsProcessed(updateId, phone, telegramId) {
  if (!updateId) return;

  try {
    await supabaseAdmin
      .from('processed_webhook_messages')
      .insert({
        message_id: String(updateId),
        phone: phone || `telegram:${telegramId}`,
        source: TELEGRAM_SOURCE,
        telegram_id: telegramId,
      })
      .then(() => {
        console.log(`[telegram-webhook] Update ${updateId} marcado como procesado`);
      })
      .catch((err) => {
        if (err?.code === '23505') {
          console.log(`[telegram-webhook] Update ${updateId} ya estaba marcado como procesado`);
        } else {
          console.error('[telegram-webhook] Error marcando update como procesado:', err);
        }
      });
  } catch (error) {
    console.error('[telegram-webhook] Error en markMessageAsProcessed:', error);
  }
}

async function handleCommand(command, telegramId, userId, profile) {
  let response;

  try {
    switch (command) {
      case 'start':
        // Mostrar menú principal con botones
        await showStartMenu(telegramId, true);
        response = null; // El menú ya se envió
        break;

      case 'nuevo':
        if ((profile?.credits_remaining || 0) <= 0) {
          response =
            'No tienes créditos disponibles.\n\nCada diagnóstico consume 1 crédito. Contacta al administrador para recargarlos.';
        } else {
          response = await handleNuevoCommand(telegramId, userId);
        }
        break;

      case 'historial':
        response = await handleHistorialCommand(userId);
        break;

      case 'creditos':
        response = await handleCreditosCommand(userId);
        break;

      case 'ayuda':
      default:
        response = await handleAyudaCommand();
        break;
    }

    if (response) {
      await sendTelegramMessage(telegramId, response);
    }
  } catch (error) {
    console.error(`[telegram-webhook] Error ejecutando comando ${command}:`, error);
    await sendTelegramMessage(
      telegramId,
      'Ocurrió un error procesando tu comando. Intenta nuevamente más tarde.'
    );
  }
}

function extractMessageText(message) {
  if (!message) return '';
  if (message.text) return message.text.trim();
  if (message.caption) return message.caption.trim();
  return '';
}

function getQuickDiagnosisPhoto(message) {
  if (!message?.photo?.length) return null;
  return message.photo[message.photo.length - 1];
}

export async function POST(request) {
  try {
    const body = await request.json();
    const updateId = body?.update_id;
    const message = body?.message;
    const callbackQuery = body?.callback_query;

    if (!updateId) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (message) {
      await processIncomingTelegramUpdate(updateId, message);
    } else if (callbackQuery) {
      await processCallbackQuery(updateId, callbackQuery);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[telegram-webhook] Error procesando webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error interno',
      },
      { status: 500 }
    );
  }
}

async function processIncomingTelegramUpdate(updateId, message) {
  const telegramId = message.from?.id;
  if (!telegramId) {
    console.warn('[telegram-webhook] No se detectó telegram_id en el mensaje');
    return;
  }

  const normalizedTelegramId = String(telegramId);
  let profile = null;
  let profilePhone = `telegram:${normalizedTelegramId}`;
  let shouldMarkProcessed = true;

  try {
    const { data: existing } = await supabaseAdmin
      .from('processed_webhook_messages')
      .select('id')
      .eq('message_id', String(updateId))
      .eq('source', TELEGRAM_SOURCE)
      .maybeSingle()
      .catch(() => ({ data: null }));

    if (existing) {
      console.log(`[telegram-webhook] Update ${updateId} ya fue procesado, omitiendo...`);
      shouldMarkProcessed = false;
      return;
    }

    profile = await findUserByTelegramId(normalizedTelegramId);
    profilePhone = profile?.phone || profilePhone;

    if (!profile) {
      console.log(`[telegram-webhook] Usuario no registrado: telegramId=${normalizedTelegramId}`);
      await sendTelegramMessage(
        normalizedTelegramId,
        'Tu cuenta de Telegram no está vinculada a TEC Rural Diagnóstico.\n\nVisita la aplicación web y vincula tu cuenta para usar el bot: https://tec-rural-diagnostico.vercel.app'
      );
      return;
    }

    const text = message.text?.trim() || '';

    if (text) {
      const command = detectCommand(text);
      if (command) {
        await handleCommand(command, normalizedTelegramId, profile.id, profile);
        return;
      }
    }

    const quickPhoto = getQuickDiagnosisPhoto(message);
    if (quickPhoto && message.caption?.trim()) {
      await handleQuickDiagnosis(message, quickPhoto.file_id, normalizedTelegramId, profile.id, profile);
      return;
    }

    await handleConversationalFlow(message, normalizedTelegramId, profile.id, profile);
  } finally {
    if (shouldMarkProcessed) {
      await markMessageAsProcessed(updateId, profilePhone, normalizedTelegramId);
    }
  }
}

async function handleQuickDiagnosis(message, fileId, telegramId, userId, profile) {
  const caption = message.caption?.trim() || '';

  if ((profile?.credits_remaining || 0) <= 0) {
    await sendTelegramMessage(
      telegramId,
      'No tienes créditos disponibles. Contacta al administrador para obtener más.'
    );
    return;
  }

  let cultivoName = '';
  let notes = '';

  if (caption.includes('-')) {
    const parts = caption.split('-').map((part) => part.trim());
    cultivoName = parts[0];
    notes = parts.slice(1).join(' - ');
  } else {
    cultivoName = caption;
  }

  if (!cultivoName || cultivoName.length < 2) {
    await sendTelegramMessage(
      telegramId,
      `Para hacer un diagnóstico rápido envía una imagen con el nombre del cultivo en el texto.

*Ejemplos:*
• cafetales
• maíz - hojas amarillas
• tomate - manchas en frutos

o usa /nuevo para el flujo paso a paso.`
    );
    return;
  }

  if (!fileId) {
    await sendTelegramMessage(
      telegramId,
      'No se pudo obtener la imagen. Intenta nuevamente con una foto adjunta.'
    );
    return;
  }

  await sendTelegramMessage(telegramId, '🔄 Analizando tu imagen... Esto puede tardar unos segundos.');

  try {
    const imageBuffer = await downloadTelegramFile(fileId);
    const mimeType = 'image/jpeg';

    const diagnosisResult = await runDiagnosis({
      userId,
      cultivoName,
      notes,
      imageBuffer,
      mimeType,
      source: TELEGRAM_SOURCE,
    });

    if (diagnosisResult.needsBetterPhoto) {
      await sendTelegramMessage(
        telegramId,
        `${diagnosisResult.message || 'La imagen no fue concluyente.'}\n\nPor favor envía otra foto más clara.`
      );
      return;
    }

    if (diagnosisResult.error) {
      console.error('[telegram-webhook] Error en diagnóstico rápido:', diagnosisResult.error);
      await sendTelegramMessage(
        telegramId,
        diagnosisResult.error ||
          'Ocurrió un error procesando tu diagnóstico. Intenta nuevamente más tarde.'
      );
      return;
    }

    const diagnosis = diagnosisResult.diagnosis;
    const confidence = diagnosis?.confidence_score
      ? Math.round(diagnosis.confidence_score * 100)
      : 0;

    const resultText = `✅ *Diagnóstico completado*

🌱 Cultivo: ${diagnosis?.cultivo_name || cultivoName}
📊 Confianza: ${confidence}%

${diagnosis?.ai_diagnosis_md || 'Diagnóstico no disponible.'}

💳 Créditos restantes: ${diagnosisResult.remainingCredits || 0}`;

    await sendTelegramMessage(telegramId, resultText);

    if (diagnosis?.image_url) {
      await sendTelegramPhoto(
        telegramId,
        diagnosis.image_url,
        `Diagnóstico TEC Rural - ${diagnosis.cultivo_name}`
      );
    }

    console.log(
      `[telegram-webhook] Diagnóstico rápido completado para telegramId=${telegramId}, ID=${diagnosis?.id}`
    );
  } catch (error) {
    console.error('[telegram-webhook] Error en diagnóstico rápido:', error);
    await sendTelegramMessage(
      telegramId,
      'Ocurrió un error procesando tu imagen. Intenta nuevamente en unos minutos.'
    );
  }
}

async function handleConversationalFlow(message, telegramId, userId, profile) {
  const session = await getActiveSession(telegramId);

  if (!session || session.state === 'idle') {
    const helpText = `Hola! Soy el asistente de diagnóstico de TEC Rural.

Escribe /nuevo para iniciar un diagnóstico guiado o /ayuda para ver los comandos disponibles.`;
    await sendTelegramMessage(telegramId, helpText);
    return;
  }

  console.log(`[telegram-webhook] Sesión activa en estado: ${session.state}`);

  switch (session.state) {
    case 'awaiting_cultivo':
      await handleCultivoInput(message, telegramId);
      break;
    case 'awaiting_notes':
      await handleNotesInput(message, telegramId);
      break;
    case 'awaiting_image':
      await handleImageInput(message, telegramId, userId, profile);
      break;
    case 'processing':
      await sendTelegramMessage(telegramId, 'Tu diagnóstico está siendo procesado. Por favor espera.');
      break;
    default:
      await sendTelegramMessage(
        telegramId,
        'Estado desconocido. Escribe /nuevo para comenzar un diagnóstico.'
      );
      await clearSession(telegramId);
  }
}

async function handleCultivoInput(message, telegramId) {
  const text = message.text?.trim();

  if (!text) {
    await sendTelegramMessage(telegramId, 'Por favor envía el nombre del cultivo como texto.');
    return;
  }

  if (text.length < 2) {
    await sendTelegramMessage(
      telegramId,
      'El nombre del cultivo debe tener al menos 2 caracteres. Intenta nuevamente.'
    );
    return;
  }

  console.log(`[telegram-webhook] Cultivo recibido: ${text}`);

  await updateSessionState(telegramId, 'awaiting_notes', { cultivo_name: text });

  const responseText = `Perfecto! Cultivo: *${text}*

Ahora describe los síntomas que observas (opcional). Puedes escribir "omitir" si prefieres enviar solo la imagen.`;
  await sendTelegramMessage(telegramId, responseText);
}

async function handleNotesInput(message, telegramId) {
  if (message.photo?.length) {
    console.log('[telegram-webhook] Usuario envió imagen directamente, omitiendo notas');
    await updateSessionState(telegramId, 'awaiting_image', { user_notes: '' });
    return;
  }

  const text = message.text?.trim();
  if (!text) {
    await sendTelegramMessage(
      telegramId,
      'Por favor envía texto con los síntomas, escribe "omitir" o envía directamente la imagen.'
    );
    return;
  }

  const normalized = text.toLowerCase();
  const notes =
    normalized === 'omitir' || normalized === 'skip' || normalized === 'no'
      ? ''
      : message.text?.trim() || '';

  console.log(
    `[telegram-webhook] Notas recibidas: ${notes ? notes.substring(0, 50) + '...' : 'omitir'}`
  );

  await updateSessionState(telegramId, 'awaiting_image', { user_notes: notes });

  await sendTelegramMessage(
    telegramId,
    'Entendido.\n\nAhora envía una foto clara de la planta mostrando los síntomas.'
  );
}

async function handleImageInput(message, telegramId, userId, profile) {
  const photo = getQuickDiagnosisPhoto(message);

  if (!photo) {
    await sendTelegramMessage(telegramId, 'Por favor envía una imagen de la planta.');
    return;
  }

  console.log('[telegram-webhook] Mensaje con foto recibido:', JSON.stringify(message, null, 2));

  if ((profile?.credits_remaining || 0) <= 0) {
    await sendTelegramMessage(
      telegramId,
      'No tienes créditos disponibles para crear un diagnóstico. Contacta al administrador.'
    );
    await clearSession(telegramId);
    return;
  }

  await updateSessionState(telegramId, 'processing', {});

  await sendTelegramMessage(telegramId, '🔄 Procesando tu imagen... Esto puede tomar unos segundos.');

  try {
    const imageBuffer = await downloadTelegramFile(photo.file_id);
    const mimeType = 'image/jpeg';

    const currentSession = await getActiveSession(telegramId);

    if (!currentSession) {
      await sendTelegramMessage(telegramId, 'Tu sesión expiró. Escribe /nuevo para comenzar de nuevo.');
      return;
    }

    const diagnosisResult = await runDiagnosis({
      userId,
      cultivoName: currentSession.cultivo_name,
      notes: currentSession.user_notes || '',
      imageBuffer,
      mimeType,
      source: TELEGRAM_SOURCE,
    });

    if (diagnosisResult.needsBetterPhoto) {
      await sendTelegramMessage(
        telegramId,
        `${diagnosisResult.message || 'La imagen no fue concluyente.'}\n\nPor favor envía otra foto más clara.`
      );
      await updateSessionState(telegramId, 'awaiting_image', {});
      return;
    }

    if (diagnosisResult.error) {
      console.error('[telegram-webhook] Error en diagnóstico:', diagnosisResult.error);
      await sendTelegramMessage(
        telegramId,
        diagnosisResult.error ||
          'Ocurrió un error procesando tu diagnóstico. Intenta nuevamente más tarde.'
      );
      await clearSession(telegramId);
      return;
    }

    const diagnosis = diagnosisResult.diagnosis;
    const confidence = diagnosis?.confidence_score
      ? Math.round(diagnosis.confidence_score * 100)
      : 0;

    const resultText = `✅ *Diagnóstico completado*

🌱 Cultivo: ${diagnosis?.cultivo_name || 'Cultivo'}
📊 Confianza: ${confidence}%

${diagnosis?.ai_diagnosis_md || 'Diagnóstico no disponible.'}

💳 Créditos restantes: ${diagnosisResult.remainingCredits || 0}`;

    await sendTelegramMessage(telegramId, resultText);

    if (diagnosis?.image_url) {
      await sendTelegramPhoto(
        telegramId,
        diagnosis.image_url,
        `Diagnóstico TEC Rural - ${diagnosis.cultivo_name}`
      );
    }

    await clearSession(telegramId);

    console.log(
      `[telegram-webhook] Diagnóstico completado para telegramId=${telegramId}, ID=${diagnosis?.id}`
    );
  } catch (error) {
    console.error('[telegram-webhook] Error procesando imagen:', error);
    await sendTelegramMessage(
      telegramId,
      'Ocurrió un error procesando tu imagen. Por favor intenta nuevamente más tarde.'
    );
    await clearSession(telegramId);
  }
}

/**
 * Procesa callback queries de botones inline
 * Se ejecuta cuando el usuario presiona un botón en el menú
 */
async function processCallbackQuery(updateId, callbackQuery) {
  const telegramId = String(callbackQuery.from?.id);
  const callbackData = callbackQuery.data;
  const queryId = callbackQuery.id;

  if (!telegramId || !callbackData) {
    console.warn('[telegram-webhook] Callback query sin datos válidos');
    return;
  }

  console.log(`[telegram-webhook] Callback query recibida: telegramId=${telegramId}, data=${callbackData}`);

  try {
    // Encontrar usuario
    const profile = await findUserByTelegramId(telegramId);

    if (!profile) {
      await sendTelegramMessage(
        telegramId,
        'Tu cuenta de Telegram no está vinculada. Visita https://tec-rural-diagnostico.vercel.app para vincular.'
      );
      return;
    }

    // Manejar el callback como si fuera un comando
    const commandMap = {
      nuevo: 'nuevo',
      historial: 'historial',
      creditos: 'creditos',
      ayuda: 'ayuda',
    };

    const command = commandMap[callbackData];

    if (command) {
      await handleCommand(command, telegramId, profile.id, profile);

      // Notificar que el botón fue presionado (desaparece la animación de "cargando")
      // Nota: Telegram espera answerCallbackQuery para remover la notificación de carga
      // pero lo hacemos de forma asíncrona sin esperar respuesta
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: queryId,
              text: '✅ Procesado',
              show_alert: false,
            }),
          }).catch(() => {
            // Ignorar errores en answerCallbackQuery
          });
        }
      } catch (err) {
        console.error('[telegram-webhook] Error enviando answerCallbackQuery:', err);
      }
    } else {
      await sendTelegramMessage(
        telegramId,
        'Opción no reconocida. Intenta de nuevo con /ayuda'
      );
    }

    // Marcar update como procesado
    await markMessageAsProcessed(updateId, null, telegramId);
  } catch (error) {
    console.error('[telegram-webhook] Error procesando callback query:', error);
    await sendTelegramMessage(
      telegramId,
      'Ocurrió un error. Intenta nuevamente más tarde.'
    );
  }
}
