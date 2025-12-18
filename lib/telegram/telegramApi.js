/**
 * Cliente de API de Telegram Bot
 * Documentación oficial: https://core.telegram.org/bots/api
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!TELEGRAM_BOT_TOKEN) {
  console.warn(
    'La variable de entorno TELEGRAM_BOT_TOKEN no está configurada. Las funciones de Telegram no estarán disponibles.'
  );
}

/**
 * Realiza una petición a la API de Telegram
 * @param {string} method - Método de la API (ej: 'sendMessage', 'sendPhoto')
 * @param {Object} payload - Datos a enviar
 * @returns {Promise<Object>} Respuesta de Telegram
 */
async function telegramRequest(method, payload) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Configura TELEGRAM_BOT_TOKEN para usar el bot de Telegram.');
  }

  const url = `${TELEGRAM_API_URL}/${method}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error(`Error en la petición a Telegram: ${method}`, data);
      throw new Error(`Error en Telegram: ${data.description || res.status}`);
    }

    return data.result;
  } catch (error) {
    console.error(`Fallo al realizar la petición a Telegram (${method}):`, error);
    throw error;
  }
}

/**
 * Envía un mensaje de texto
 * @param {string|number} telegramId - ID del chat de Telegram
 * @param {string} text - Texto del mensaje (puede incluir Markdown)
 * @param {Object} options - Opciones adicionales (reply_markup, parse_mode, etc.)
 * @returns {Promise<Object>} Mensaje enviado
 */
export async function sendTelegramMessage(telegramId, text, options = {}) {
  if (!telegramId) throw new Error('El ID de Telegram es requerido.');
  if (!text) throw new Error('El texto del mensaje no puede estar vacío.');

  return telegramRequest('sendMessage', {
    chat_id: telegramId,
    text: String(text),
    parse_mode: 'Markdown',
    ...options,
  });
}

/**
 * Envía una foto con caption
 * @param {string|number} telegramId - ID del chat de Telegram
 * @param {string} photoUrl - URL de la imagen
 * @param {string} caption - Texto descriptivo (opcional)
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Mensaje enviado
 */
export async function sendTelegramPhoto(telegramId, photoUrl, caption = '', options = {}) {
  if (!telegramId) throw new Error('El ID de Telegram es requerido.');
  if (!photoUrl) throw new Error('La URL de la imagen es obligatoria.');

  return telegramRequest('sendPhoto', {
    chat_id: telegramId,
    photo: String(photoUrl),
    caption: caption ? String(caption) : undefined,
    parse_mode: 'Markdown',
    ...options,
  });
}

/**
 * Obtiene información de un archivo
 * @param {string} fileId - ID del archivo de Telegram
 * @returns {Promise<Object>} Información del archivo (file_path, file_size, etc.)
 */
export async function getTelegramFile(fileId) {
  if (!fileId) throw new Error('El ID del archivo es requerido.');

  return telegramRequest('getFile', {
    file_id: fileId,
  });
}

/**
 * Descarga un archivo de Telegram
 * @param {string} fileId - ID del archivo de Telegram
 * @returns {Promise<Buffer>} Buffer del archivo descargado
 */
export async function downloadTelegramFile(fileId) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Configura TELEGRAM_BOT_TOKEN para descargar archivos de Telegram.');
  }

  if (!fileId) {
    throw new Error('El ID del archivo es requerido.');
  }

  console.log('[telegram] Obteniendo información del archivo:', fileId);

  // Primero obtener la ruta del archivo
  const fileInfo = await getTelegramFile(fileId);
  const filePath = fileInfo.file_path;

  if (!filePath) {
    throw new Error('No se pudo obtener la ruta del archivo.');
  }

  // Construir la URL de descarga
  const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

  console.log('[telegram] Descargando archivo desde:', downloadUrl);

  try {
    const res = await fetch(downloadUrl, {
      method: 'GET',
    });

    console.log('[telegram] Respuesta de descarga:', res.status, res.statusText);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'No se pudo leer el error');
      console.error(`[telegram] Error descargando archivo: ${res.status} ${res.statusText}`);
      console.error('[telegram] Body del error:', errorBody);
      throw new Error(`Error descargando archivo: ${res.status} - ${errorBody}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[telegram] Archivo descargado exitosamente:', buffer.length, 'bytes');
    return buffer;
  } catch (error) {
    console.error('[telegram] Error en downloadTelegramFile:', error);
    throw error;
  }
}

/**
 * Envía un mensaje de error formateado
 * @param {string|number} telegramId - ID del chat de Telegram
 * @param {string} errorMessage - Mensaje de error
 * @returns {Promise<Object>} Mensaje enviado
 */
export async function sendTelegramError(telegramId, errorMessage) {
  const text = `❌ *Error*\n\n${errorMessage}\n\nEscribe /ayuda para ver los comandos disponibles.`;
  return sendTelegramMessage(telegramId, text);
}

/**
 * Responde a un callback query (botón inline)
 * IMPORTANTE: Siempre debe llamarse cuando se recibe un callback_query
 * para quitar el spinner del botón
 * @param {string} callbackQueryId - ID del callback query
 * @param {string} text - Texto de notificación (opcional)
 * @param {boolean} showAlert - Mostrar como alerta (default: false)
 * @returns {Promise<boolean>} true si se respondió correctamente
 */
export async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  if (!callbackQueryId) throw new Error('El callback_query_id es requerido.');

  return telegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || undefined,
    show_alert: showAlert,
  });
}

/**
 * Envía una acción de chat (typing, upload_photo, etc.)
 * Útil para mostrar que el bot está procesando
 * @param {string|number} telegramId - ID del chat de Telegram
 * @param {string} action - Tipo de acción ('typing', 'upload_photo', etc.)
 * @returns {Promise<boolean>} true si se envió correctamente
 */
export async function sendChatAction(telegramId, action = 'typing') {
  if (!telegramId) throw new Error('El ID de Telegram es requerido.');

  return telegramRequest('sendChatAction', {
    chat_id: telegramId,
    action,
  });
}

/**
 * Establece el webhook de Telegram
 * @param {string} webhookUrl - URL del webhook
 * @param {Array<string>} allowedUpdates - Tipos de updates permitidos
 * @returns {Promise<boolean>} true si se configuró correctamente
 */
export async function setTelegramWebhook(webhookUrl, allowedUpdates = ['message', 'callback_query']) {
  if (!webhookUrl) throw new Error('La URL del webhook es requerida.');

  return telegramRequest('setWebhook', {
    url: webhookUrl,
    allowed_updates: allowedUpdates,
  });
}

/**
 * Obtiene información del webhook actual
 * @returns {Promise<Object>} Información del webhook
 */
export async function getTelegramWebhookInfo() {
  return telegramRequest('getWebhookInfo', {});
}

/**
 * Elimina el webhook configurado
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export async function deleteTelegramWebhook() {
  return telegramRequest('deleteWebhook', {});
}
