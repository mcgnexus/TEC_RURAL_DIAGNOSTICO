import { NextResponse } from 'next/server';
import { getGeminiKey, callGeminiApi } from '@/lib/gemini';

export const runtime = 'nodejs';

const isDebugEnabled = () =>
  process.env.DIAGNOSE_DEBUG === '1' || process.env.NEXT_PUBLIC_DIAGNOSE_DEBUG === '1';

const fingerprint = value => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return `***${trimmed.slice(-5)}`;
};

const keyLooksValid = value => {
  if (!value) return false;
  const trimmed = String(value).trim();
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
};

export async function GET() {
  const debugEnabled = isDebugEnabled();
  const envGemini = process.env.GEMINI_API_KEY;
  const envGoogle = process.env.GOOGLE_API_KEY;

  try {
    const key = getGeminiKey();
    const startedAt = Date.now();

    const payload = {
      contents: [{ role: 'user', parts: [{ text: 'Hola' }] }],
    };

    const geminiResult = await callGeminiApi(payload, {
      debug: debugEnabled,
      returnMeta: debugEnabled,
    });
    const data = debugEnabled ? geminiResult.data : geminiResult;
    const usedMeta = debugEnabled ? geminiResult.meta : null;
    const elapsedMs = Date.now() - startedAt;

    const sampleText = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    const resp = {
      ok: true,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      elapsedMs,
      sampleText,
    };

    if (debugEnabled) {
      resp.debug = {
        endpoint: 'v1beta',
        usedEnvVar: usedMeta?.usedEnvVar || null,
        usedKeyFingerprint: usedMeta?.usedKeyFingerprint || null,
        selectedEnvVar: envGemini ? 'GEMINI_API_KEY' : envGoogle ? 'GOOGLE_API_KEY' : null,
        selectedKeyFingerprint: fingerprint(key),
        selectedKeyLength: key ? String(key).trim().length : 0,
        selectedKeyCharsOk: keyLooksValid(key),
        geminiKeyFingerprint: fingerprint(envGemini),
        googleKeyFingerprint: fingerprint(envGoogle),
      };
    }

    return NextResponse.json(resp);
  } catch (error) {
    const message = error?.message || 'Error desconocido';
    const statusMatch = message.match(/Gemini API error:\s+(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;

    let friendly = 'Error comunicando con la API de Gemini.';
    if (status === 401 || status === 403) {
      friendly = 'Clave de Gemini inválida o sin permisos.';
    } else if (status === 429) {
      friendly = 'Demasiadas solicitudes al proveedor de IA. Intenta en unos minutos.';
    } else if (status === 503) {
      friendly = 'Servicio de IA sobrecargado. Intenta más tarde.';
    }

    const resp = { ok: false, error: friendly, details: message };

    if (debugEnabled) {
      const selectedRaw = envGemini || envGoogle || null;
      resp.debug = {
        endpoint: 'v1beta',
        usedEnvVar: error?.geminiMeta?.usedEnvVar || null,
        usedKeyFingerprint: error?.geminiMeta?.usedKeyFingerprint || null,
        selectedEnvVar: envGemini ? 'GEMINI_API_KEY' : envGoogle ? 'GOOGLE_API_KEY' : null,
        selectedKeyFingerprint: fingerprint(selectedRaw),
        selectedKeyLength: selectedRaw ? String(selectedRaw).trim().length : 0,
        selectedKeyCharsOk: keyLooksValid(selectedRaw),
        geminiKeyFingerprint: fingerprint(envGemini),
        googleKeyFingerprint: fingerprint(envGoogle),
      };
    }

    return NextResponse.json(resp, { status });
  }
}
