import { redactForLog, redactString } from '@/lib/logging';
const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_MEDIA_HOSTS = process.env.WHAPI_MEDIA_HOSTS || '';

if (!WHAPI_TOKEN) {
  console.warn(
    'La variable de entorno WHAPI_TOKEN no está configurada. Las funciones de Whapi no estarán disponibles.'
  );
}

const toWhapiChatId = phone => {
  const cleaned = String(phone || '').replace(/[^\d]/g, '');
  if (!cleaned) return null;
  return `${cleaned}@s.whatsapp.net`;
};

const resolveWhapiHost = () => {
  try {
    return new URL(WHAPI_API_URL).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const allowedMediaHosts = (() => {
  const hosts = new Set();
  const baseHost = resolveWhapiHost();
  if (baseHost) hosts.add(baseHost);
  WHAPI_MEDIA_HOSTS.split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean)
    .forEach(host => hosts.add(host));
  return hosts;
})();

const isWhapiMediaHost = host => {
  if (!host) return false;
  if (allowedMediaHosts.has(host)) return true;
  return host.endsWith('.whapi.cloud');
};

async function whapiRequest(path, payload) {
  if (!WHAPI_TOKEN) {
    throw new Error('Configura WHAPI_TOKEN para enviar WhatsApp vía Whapi.');
  }

  const url = `${WHAPI_API_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHAPI_TOKEN}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'No se pudo leer el cuerpo del error');
      console.error(`Error en la petición a Whapi: ${res.status} ${res.statusText}`, redactString(errorBody));
      throw new Error(`Error en Whapi: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Fallo al realizar la petición a Whapi:', redactForLog(error));
    throw error;
  }
}

export async function sendWhatsAppText({ to, text }) {
  const chatId = toWhapiChatId(to);
  if (!chatId) throw new Error('Número de teléfono destino inválido.');
  if (!text) throw new Error('El texto del mensaje no puede estar vacío.');

  return whapiRequest('messages/text', {
    to: chatId,
    body: String(text),
  });
}

export async function sendWhatsAppImage({ to, imageUrl, caption = '' }) {
  const chatId = toWhapiChatId(to);
  if (!chatId) throw new Error('Número de teléfono destino inválido.');
  if (!imageUrl) throw new Error('La URL de la imagen es obligatoria.');

  return whapiRequest('messages/image', {
    to: chatId,
    media: String(imageUrl),
    caption: String(caption || ''),
  });
}

/**
 * Descarga una imagen desde la URL de WhatsApp media
 * @param {string} mediaUrl - URL del archivo de whapi (image.link)
 * @returns {Promise<Buffer>} Buffer de la imagen descargada
 */
export async function downloadWhatsAppMedia(mediaUrl) {
  if (!WHAPI_TOKEN) {
    throw new Error('Configura WHAPI_TOKEN para descargar medios de WhatsApp.');
  }

  if (!mediaUrl) {
    throw new Error('La URL del media es requerida.');
  }

  let host = '';
  try {
    host = new URL(mediaUrl).hostname.toLowerCase();
  } catch {
    throw new Error('La URL del media es invalida.');
  }

  if (!isWhapiMediaHost(host)) {
    console.warn('[whapi] Host de media no permitido:', host);
    throw new Error('La URL del media no es valida para descargar.');
  }

  try {
    const origin = new URL(mediaUrl).origin;
    console.log('[whapi] Descargando media', { origin });
  } catch {
    console.log('[whapi] Descargando media', { url: redactString(mediaUrl) });
  }

  try {
    const headers = {};
    const shouldAttachAuth =
      host === resolveWhapiHost() || host.endsWith('.whapi.cloud');
    if (WHAPI_TOKEN && shouldAttachAuth) {
      headers.Authorization = `Bearer ${WHAPI_TOKEN}`;
    }
    const res = await fetch(mediaUrl, {
      method: 'GET',
      headers,
    });

    console.log('[whapi] Respuesta de descarga:', res.status, res.statusText);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'No se pudo leer el error');
      console.error(`[whapi] Error descargando media: ${res.status} ${res.statusText}`);
      console.error('[whapi] Body del error:', redactString(errorBody));
      throw new Error(`Error descargando media: ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[whapi] Media descargada exitosamente:', buffer.length, 'bytes');
    return buffer;
  } catch (error) {
    console.error('[whapi] Error en downloadWhatsAppMedia:', redactForLog(error));
    throw error;
  }
}

/**
 * Normaliza un número de teléfono desde formato WhatsApp
 * @param {string} chatId - Chat ID de WhatsApp (ej: "573001234567@s.whatsapp.net")
 * @returns {string} Número normalizado (ej: "+573001234567")
 */
export function normalizePhoneFromChatId(chatId) {
  if (!chatId) return '';

  // Extraer solo el número, quitar @s.whatsapp.net y otros sufijos
  const phone = String(chatId).split('@')[0];

  // Añadir + si no lo tiene
  return phone.startsWith('+') ? phone : `+${phone}`;
}

/**
 * Envía un mensaje de error formateado
 * @param {string} to - Número de teléfono destino
 * @param {string} errorMessage - Mensaje de error
 * @returns {Promise<Object>} Respuesta de Whapi
 */
export async function sendWhatsAppError(to, errorMessage) {
  const text = `❌ *Error*\n\n${errorMessage}\n\nEscribe /ayuda para ver los comandos disponibles.`;
  return sendWhatsAppText({ to, text });
}
