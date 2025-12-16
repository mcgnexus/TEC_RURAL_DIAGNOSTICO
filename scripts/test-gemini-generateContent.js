try {
  // Permite ejecutar el script sin exportar vars manualmente (lee `.env.local` si existe).
  require('dotenv').config({ path: '.env.local' });
} catch {
  // ignore
}

async function main() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    console.error('Falta GEMINI_API_KEY (o GOOGLE_API_KEY) en el entorno.');
    process.exit(1);
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: 'Responde solamente con la palabra: ok' }] }],
    generationConfig: { temperature: 0 },
  };

  const startedAt = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
  });
  const bodyText = await res.text();

  console.log('url:', url);
  console.log('keyFingerprint:', `***${key.slice(-5)}`);
  console.log('status:', res.status);
  console.log('elapsedMs:', Date.now() - startedAt);
  console.log('body:', bodyText);

  try {
    const json = JSON.parse(bodyText);
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) console.log('parsedText:', text);
  } catch {
    // ignore
  }

  process.exit(res.ok ? 0 : 2);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(3);
});
