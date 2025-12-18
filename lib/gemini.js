const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const normalizeKey = value => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const fingerprint = value => (value ? `***${String(value).slice(-5)}` : null);

const isInvalidKeyError = (status, errorBody) => {
  if (status !== 400 && status !== 401 && status !== 403) return false;
  const lower = String(errorBody || '').toLowerCase();
  return lower.includes('api key not valid') || lower.includes('api_key_invalid');
};

export function getGeminiKeyCandidates() {
  const envGemini = normalizeKey(process.env.GEMINI_API_KEY);
  const envGoogle = normalizeKey(process.env.GOOGLE_API_KEY);

  const candidates = [];
  if (envGemini) candidates.push({ name: 'GEMINI_API_KEY', key: envGemini });
  if (envGoogle && envGoogle !== envGemini) {
    candidates.push({ name: 'GOOGLE_API_KEY', key: envGoogle });
  }

  return candidates;
}

export function getGeminiKey() {
  const candidates = getGeminiKeyCandidates();
  const key = candidates[0]?.key || null;

  if (!key) {
    throw new Error('Configura GEMINI_API_KEY o GOOGLE_API_KEY para usar Gemini.');
  }

  return key;
}

export async function callGeminiApi(payload, { debug = false, returnMeta = false } = {}) {
  const candidates = getGeminiKeyCandidates();
  if (candidates.length === 0) {
    throw new Error('Configura GEMINI_API_KEY o GOOGLE_API_KEY para usar Gemini.');
  }

  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': candidate.key },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      if (returnMeta) {
        return {
          data,
          meta: {
            usedEnvVar: candidate.name,
            usedKeyFingerprint: fingerprint(candidate.key),
          },
        };
      }
      return data;
    }

    const errorBody = await response.text();
    const error = new Error(`Gemini API error: ${response.status} - ${errorBody}`);
    error.geminiMeta = {
      usedEnvVar: candidate.name,
      usedKeyFingerprint: fingerprint(candidate.key),
    };

    const shouldFallback =
      isInvalidKeyError(response.status, errorBody) && index < candidates.length - 1;

    if (shouldFallback) {
      lastError = error;
      if (debug) {
        console.warn('[gemini] API_KEY_INVALID, probando key alterna', error.geminiMeta);
      }
      continue;
    }

    if (debug) {
      error.message += ` (keyFingerprint: ${fingerprint(candidate.key)} via ${candidate.name})`;
    }

    throw error;
  }

  throw lastError || new Error('Gemini API error: unknown');
}
