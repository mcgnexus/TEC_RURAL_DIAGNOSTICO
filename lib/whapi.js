import { redactForLog, redactString } from '@/lib/logging';
const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_MEDIA_HOSTS = process.env.WHAPI_MEDIA_HOSTS || '';
const WHAPI_MAX_IMAGE_BYTES = Number(process.env.WHAPI_MAX_IMAGE_BYTES || 5 * 1024 * 1024);

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
  if (host === 'whapi.cloud' || host.endsWith('.whapi.cloud')) return true;
  if (host === 'wasabisys.com' || host.endsWith('.wasabisys.com')) return true;
  return false;
};

class WhapiError extends Error {
  constructor(message, { status, statusText, body, url } = {}) {
    super(message);
    this.name = 'WhapiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.url = url;
  }
}

async function whapiRequest(path, payload, { method = 'POST' } = {}) {
  if (!WHAPI_TOKEN) {
    throw new Error('Configura WHAPI_TOKEN para enviar WhatsApp vía Whapi.');
  }

  const url = `${WHAPI_API_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  try {
    const res = await fetch(url, {
      method,
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
      throw new WhapiError(`Error en Whapi: ${res.status}`, {
        status: res.status,
        statusText: res.statusText,
        body: errorBody,
        url,
      });
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

const normalizeMimeType = value => {
  if (!value) return '';
  return String(value).split(';')[0].trim().toLowerCase();
};

const guessImageMimeTypeFromUrl = urlString => {
  const lower = String(urlString || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const isSafeHttpUrlForServerFetch = value => {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  return true;
};

async function fetchAsDataUri(imageUrl) {
  if (!isSafeHttpUrlForServerFetch(imageUrl)) {
    throw new Error('La URL de la imagen no es válida para descargar desde el servidor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(String(imageUrl), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'No se pudo leer el error');
      throw new Error(`No se pudo descargar la imagen: ${res.status} ${redactString(errorBody)}`);
    }

    const contentLengthHeader = res.headers?.get?.('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
    if (Number.isFinite(contentLength) && contentLength > WHAPI_MAX_IMAGE_BYTES) {
      const mb = (WHAPI_MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(0);
      throw new Error(`La imagen supera el tamaño máximo permitido (${mb}MB).`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > WHAPI_MAX_IMAGE_BYTES) {
      const mb = (WHAPI_MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(0);
      throw new Error(`La imagen supera el tamaño máximo permitido (${mb}MB).`);
    }

    const headerMime = normalizeMimeType(res.headers?.get?.('content-type'));
    const mimeType = headerMime || guessImageMimeTypeFromUrl(imageUrl);
    const base64 = buffer.toString('base64');
    return {
      dataUri: `data:${mimeType};base64,${base64}`,
      mimeType,
      sizeBytes: buffer.length,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWhatsAppImage({ to, imageUrl, caption = '', prefer = 'url' }) {
  const chatId = toWhapiChatId(to);
  if (!chatId) throw new Error('Número de teléfono destino inválido.');
  if (!imageUrl) throw new Error('La URL de la imagen es obligatoria.');

  const media = String(imageUrl);
  const payload = {
    to: chatId,
    caption: String(caption || ''),
  };

  if (media.startsWith('data:')) {
    return whapiRequest('messages/image', { ...payload, media });
  }

  let urlAttemptError = null;
  if (prefer !== 'base64') {
    try {
      return await whapiRequest('messages/image', { ...payload, media });
    } catch (error) {
      urlAttemptError = error;
    }
  }

  try {
    const { dataUri } = await fetchAsDataUri(media);
    return await whapiRequest('messages/image', { ...payload, media: dataUri });
  } catch (error) {
    if (urlAttemptError) {
      console.error('[whapi] Falló envío de imagen por URL; reintentando como base64 también falló', {
        urlError: redactForLog(urlAttemptError),
        base64Error: redactForLog(error),
      });
    } else {
      console.error('[whapi] Falló envío de imagen como base64', redactForLog(error));
    }

    const fallbackText = [
      payload.caption ? payload.caption : null,
      `📷 Imagen: ${media}`,
      'No se pudo adjuntar la imagen directamente por WhatsApp. Abre el enlace para verla.',
    ]
      .filter(Boolean)
      .join('\n\n');
    return sendWhatsAppText({ to, text: fallbackText });
  }
}

async function downloadWhapiMediaById(mediaId) {
  if (!WHAPI_TOKEN) {
    throw new Error('Configura WHAPI_TOKEN para descargar medios de WhatsApp.');
  }

  const id = String(mediaId || '').trim();
  if (!id) throw new Error('El ID del media es requerido.');

  const url = `${WHAPI_API_URL.replace(/\/+$/, '')}/media/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${WHAPI_TOKEN}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'No se pudo leer el error');
    throw new Error(`Error descargando media: ${res.status} ${redactString(errorBody)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

  const rawValue = String(mediaUrl).trim();
  if (!rawValue) {
    throw new Error('La URL del media es requerida.');
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    return downloadWhapiMediaById(rawValue);
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('La URL del media es invalida.');
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (!isWhapiMediaHost(host)) {
    console.warn('[whapi] Host de media no permitido:', host);
    throw new Error('La URL del media no es valida para descargar.');
  }

  try {
    const origin = parsedUrl.origin;
    console.log('[whapi] Descargando media', { origin });
  } catch {
    console.log('[whapi] Descargando media', { url: redactString(rawValue) });
  }

  try {
    const headers = {};
    const shouldAttachAuth =
      host === resolveWhapiHost() || host.endsWith('.whapi.cloud');
    if (WHAPI_TOKEN && shouldAttachAuth) {
      headers.Authorization = `Bearer ${WHAPI_TOKEN}`;
    }
    const res = await fetch(rawValue, {
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
