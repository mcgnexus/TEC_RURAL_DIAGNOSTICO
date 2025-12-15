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

  const document = body.document || body.photo?.at(-1) || null;

  if (document?.base64) {
    const buffer = Buffer.from(document.base64, 'base64');
    return { buffer, mimeType: document.mimeType || document.mime_type || 'image/jpeg' };
  }

  const mediaUrl =
    body.imageUrl || body.mediaUrl || document?.url || document?.file_url || body.photo_url;

  if (mediaUrl) {
    const response = await fetch(mediaUrl);

    if (!response.ok) {
      throw new Error('No se pudo descargar la imagen para el diagnóstico.');
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
      payload.from?.phone_number ||
      payload.message?.contact?.phone_number ||
      payload.contact?.phone_number;

    if (!phone) {
      return NextResponse.json(
        { error: 'No se encontró un número de teléfono en el mensaje de Telegram.' },
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
            'No encontramos tu cuenta asociada a este número. Vincula tu teléfono en el panel TEC Rural.',
        },
        { status: 404 }
      );
    }

    const imageData = await extractImageFromPayload(payload);

    if (!imageData) {
      return NextResponse.json(
        { error: 'Telegram no envió ninguna imagen o archivo compatible.' },
        { status: 400 }
      );
    }

    const cultivoName =
      getField(payload, ['cultivoName', 'crop', 'cultivo'], 'Cultivo sin especificar') ||
      'Cultivo sin especificar';
    const notes =
      getField(payload, ['notes', 'text', 'message', 'caption'], '').toString() || '';

    const gpsLat =
      payload.gpsLat ||
      payload.location?.latitude ||
      payload.message?.location?.latitude ||
      null;
    const gpsLong =
      payload.gpsLong ||
      payload.location?.longitude ||
      payload.message?.location?.longitude ||
      null;

    const diagnosisResult = await runDiagnosis({
      userId: profile.id,
      cultivoName,
      notes,
      gpsLat,
      gpsLong,
      imageBuffer: imageData.buffer,
      mimeType: imageData.mimeType,
      source: 'telegram',
    });

    if (diagnosisResult.needsBetterPhoto) {
      return NextResponse.json(
        {
          message:
            diagnosisResult.message ||
            'No pudimos confirmar el diagnóstico. Envía otra foto más clara o con mejor iluminación.',
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
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
