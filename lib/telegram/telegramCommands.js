import { supabaseAdmin } from '../supabaseAdmin.js';
import { getOrCreateSession, updateSessionState } from './telegramSession.js';
import { sendTelegramMessage } from './telegramApi.js';

/**
 * Identifica si un mensaje es un comando
 * @param {string} message - Texto del mensaje
 * @returns {string|null} Nombre del comando o null
 */
export function detectCommand(message) {
  if (!message || typeof message !== 'string') {
    return null;
  }

  const normalized = message.trim().toLowerCase();

  if (normalized === '/start') {
    return 'start';
  }

  if (normalized === '/nuevo' || normalized === '/new') {
    return 'nuevo';
  }

  if (normalized === '/historial' || normalized === '/history') {
    return 'historial';
  }

  if (normalized === '/creditos' || normalized === '/credits') {
    return 'creditos';
  }

  if (normalized === '/ayuda' || normalized === '/help' || normalized === '/comandos') {
    return 'ayuda';
  }

  return null;
}

/**
 * Procesa el comando /nuevo
 * @param {string} telegramId - ID del usuario de Telegram
 * @param {string} userId - ID del usuario en profiles
 * @returns {Promise<string>} Mensaje de respuesta
 */
export async function handleNuevoCommand(telegramId, userId) {
  try {
    // Crear nueva sesión en estado awaiting_cultivo
    await getOrCreateSession(telegramId, userId);
    await updateSessionState(telegramId, 'awaiting_cultivo', {
      cultivo_name: null,
      user_notes: null,
    });

    return '¡Excelente! Vamos a crear un nuevo diagnóstico.\n\nPor favor, indícame el nombre del cultivo que deseas analizar (ej: tomate, café, maíz).';
  } catch (error) {
    console.error('[telegramCommands] Error en /nuevo:', error);
    return 'Ocurrió un error al iniciar el diagnóstico. Por favor intenta nuevamente.';
  }
}

/**
 * Procesa el comando /historial
 * @param {string} userId - ID del usuario
 * @returns {Promise<string>} Mensaje con últimos 5 diagnósticos
 */
export async function handleHistorialCommand(userId) {
  try {
    const { data: diagnoses, error } = await supabaseAdmin
      .from('diagnoses')
      .select('id, cultivo_name, confidence_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[telegramCommands] Error consultando historial:', error);
      return 'Ocurrió un error al consultar tu historial. Intenta nuevamente.';
    }

    if (!diagnoses || diagnoses.length === 0) {
      return 'Aún no tienes diagnósticos registrados.\n\nEscribe /nuevo para crear tu primer diagnóstico.';
    }

    let response = '📋 *Tus últimos diagnósticos:*\n\n';

    diagnoses.forEach((d, index) => {
      const date = new Date(d.created_at);
      const formattedDate = date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const confidence = d.confidence_score
        ? `${Math.round(d.confidence_score * 100)}%`
        : 'N/A';

      response += `${index + 1}. *${d.cultivo_name || 'Cultivo'}*\n`;
      response += `   Fecha: ${formattedDate}\n`;
      response += `   Confianza: ${confidence}\n\n`;
    });

    response += 'Para crear un nuevo diagnóstico, escribe /nuevo';

    return response;
  } catch (error) {
    console.error('[telegramCommands] Error en /historial:', error);
    return 'Ocurrió un error al consultar tu historial. Intenta nuevamente.';
  }
}

/**
 * Procesa el comando /creditos
 * @param {string} userId - ID del usuario
 * @returns {Promise<string>} Mensaje con créditos restantes
 */
export async function handleCreditosCommand(userId) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('credits_remaining')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[telegramCommands] Error consultando créditos:', error);
      return 'Ocurrió un error al consultar tus créditos. Intenta nuevamente.';
    }

    const credits = profile?.credits_remaining ?? 0;

    let response = `💳 *Créditos disponibles:* ${credits}\n\n`;

    if (credits === 0) {
      response +=
        '⚠️ No tienes créditos disponibles.\n\nCada diagnóstico consume 1 crédito. Contacta al administrador para obtener más créditos.';
    } else if (credits <= 2) {
      response +=
        '⚠️ Estás cerca de quedarte sin créditos.\n\nCada diagnóstico consume 1 crédito. Considera solicitar más créditos pronto.';
    } else {
      response += 'Cada diagnóstico consume 1 crédito.\n\nEscribe /nuevo para crear un diagnóstico.';
    }

    return response;
  } catch (error) {
    console.error('[telegramCommands] Error en /creditos:', error);
    return 'Ocurrió un error al consultar tus créditos. Intenta nuevamente.';
  }
}

/**
 * Procesa el comando /ayuda
 * @returns {Promise<string>} Mensaje de ayuda
 */
export async function handleAyudaCommand() {
  return `🤖 *Asistente de Diagnóstico TEC Rural*

*🚀 Diagnóstico Rápido (NUEVO):*
Envía una imagen con el texto:
• Solo cultivo: "tomate"
• Con síntomas: "café - hojas amarillas"
¡Recibes el diagnóstico al instante!

*📋 Comandos disponibles:*
/nuevo - Diagnóstico paso a paso
/historial - Ver últimos 5 diagnósticos
/creditos - Consultar créditos
/ayuda - Mostrar esta ayuda

*¿Cómo crear un diagnóstico?*

*Opción 1: Rápido (Recomendado)*
Envía imagen con texto adjunto:
📸 + "cultivo - síntomas"

*Opción 2: Paso a paso*
1. Envía /nuevo
2. Indica el cultivo
3. Describe síntomas
4. Envía la foto

*💡 Consejos:*
✓ Fotos con buena luz
✓ Enfoca áreas afectadas
✓ Imágenes nítidas
✓ Describe síntomas`;
}

/**
 * Muestra el menú de inicio con botones inline
 * @param {string} telegramId - ID del usuario de Telegram
 * @param {boolean} authenticated - Si el usuario está autenticado
 * @returns {Promise<void>}
 */
export async function showStartMenu(telegramId, authenticated = false) {
  if (!authenticated) {
    // Menú para usuarios no autenticados
    const text = '¡Bienvenido a TEC Rural! ¿Qué deseas hacer?';
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '🔗 Vincular cuenta existente', callback_data: 'link_account' }],
        [{ text: '🆕 Crear cuenta nueva', callback_data: 'register_new' }],
        [{ text: '❓ Ayuda', callback_data: 'ayuda' }],
      ],
    };

    await sendTelegramMessage(telegramId, text, { reply_markup: inlineKeyboard });
  } else {
    // Menú para usuarios autenticados
    const text = '¿Qué deseas hacer?';
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '🆕 Nuevo Diagnóstico', callback_data: 'nuevo' }],
        [{ text: '📋 Historial', callback_data: 'historial' }],
        [{ text: '💳 Créditos', callback_data: 'creditos' }],
        [{ text: '❓ Ayuda', callback_data: 'ayuda' }],
      ],
    };

    await sendTelegramMessage(telegramId, text, { reply_markup: inlineKeyboard });
  }
}
