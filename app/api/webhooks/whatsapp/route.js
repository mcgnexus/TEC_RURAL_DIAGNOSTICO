import { NextResponse } from 'next/server';
import { findProfileByPhone, runDiagnosis } from '@/lib/diagnosisEngine';

export const runtime = 'nodejs';

const extractImageFromPayload = async body => {
  if (body.imageBase64) {
    const cleaned = body.imageBase64.includes(',')
      ? body.imageBase64.split(',')[1]
      : body.imageBase64;
    const buffer = Buffer.from(cleaned, 'base64');
    return { buffer, mimeType: body.imageMimeType || 'image/jpeg' };
  }

  if (body.image?.base64) {
    const buffer = Buffer.from(body.image.base64, 'base64');
    return { buffer, mimeType: body.image.mimeType || 'image/jpeg' };
  }

  const possibleUrl =
    body.imageUrl || body.mediaUrl || body.media?.[0]?.url || body.image?.url;

  if (possibleUrl) {
    const response = await fetch(possibleUrl);

    if (!response.ok) {
      throw new Error('No se pudo descargar la imagen desde la URL proporcionada.');
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: body.imageMimeType || response.headers.get('content-type') || 'image/jpeg',
    };
  }

  return null;
};

const getField = (body, keys, fallback = '') => {
  for (const key of keys) {
    if (body[key]) return body[key];
  }
  return fallback;
};

export async function POST(request) {
  try {
    const payload = await request.json();

    const phone =
      payload.phone ||
      payload.from ||
      payload.sender ||
      payload.contacts?.[0]?.wa_id ||
      payload.message?.from;

    if (!phone) {
      return NextResponse.json(
        { error: 'No se encontró un número de teléfono en el payload.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await findProfileByPhone(phone);

    if (profileError) {
      return NextResponse.json(
        { error: 'Error consultando el perfil: ' + profileError },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            'No encontramos una cuenta asociada a este número. Regístrate en TEC Rural o vincula tu teléfono.',
        },
        { status: 404 }
      );
    }

    const imageData = await extractImageFromPayload(payload);

    if (!imageData) {
      return NextResponse.json(
        { error: 'No se encontró ninguna imagen en el mensaje recibido.' },
        { status: 400 }
      );
    }

    const cultivoName =
      getField(payload, ['cultivoName', 'crop', 'cultivo'], 'Cultivo sin especificar') ||
      'Cultivo sin especificar';
    const notes =
      getField(payload, ['notes', 'text', 'message', 'body'], '').toString() || '';

    const gpsLat =
      payload.gpsLat ||
      payload.location?.lat ||
      payload.location?.latitude ||
      payload.coordinates?.lat ||
      null;
    const gpsLong =
      payload.gpsLong ||
      payload.location?.lng ||
      payload.location?.longitude ||
      payload.coordinates?.lon ||
      payload.coordinates?.lng ||
      null;

    const diagnosisResult = await runDiagnosis({
      userId: profile.id,
      cultivoName,
      notes,
      gpsLat,
      gpsLong,
      imageBuffer: imageData.buffer,
      mimeType: imageData.mimeType,
      source: 'whatsapp',
    });

    if (diagnosisResult.needsBetterPhoto) {
      return NextResponse.json(
        {
          message:
            diagnosisResult.message ||
            'No pudimos ver claramente la plaga. Por favor envía otra foto más nítida.',
          needsBetterPhoto: true,
        },
        { status: 200 }
      );
    }

    if (diagnosisResult.error) {
      return NextResponse.json(
        { error: diagnosisResult.error },
        { status: diagnosisResult.statusCode || 400 }
      );
    }

    return NextResponse.json(
      {
        message: diagnosisResult.diagnosis?.ai_diagnosis_md,
        remainingCredits: diagnosisResult.remainingCredits,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
