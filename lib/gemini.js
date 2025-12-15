const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

export function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!key) {
    throw new Error('Configura GEMINI_API_KEY o GOOGLE_API_KEY para usar Gemini.');
  }

  return key;
}

export async function callGeminiApi(payload) {
  const key = getGeminiKey();
  const response = await fetch(`${GEMINI_API_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}
