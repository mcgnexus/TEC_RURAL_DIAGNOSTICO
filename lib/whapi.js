const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

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
      console.error(`Error en la petición a Whapi: ${res.status} ${res.statusText}`, errorBody);
      throw new Error(`Error en Whapi: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Fallo al realizar la petición a Whapi:', error);
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

