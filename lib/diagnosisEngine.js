import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './embeddingService.js';
import { buildGeminiPrompt } from './prompts/geminiMasterPrompt.js';
import { redactString } from './logging.js';

const MIN_CONFIDENCE = 0.7;
let cachedAdminClient = null;

const isDebugEnabled = () =>
  process.env.DIAGNOSE_DEBUG === '1' || process.env.NEXT_PUBLIC_DIAGNOSE_DEBUG === '1';

const normalizeKey = value => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const getGeminiKeyCandidates = () => {
  const envGemini = normalizeKey(process.env.GEMINI_API_KEY);
  const envGoogle = normalizeKey(process.env.GOOGLE_API_KEY);

  const candidates = [];
  if (envGemini) candidates.push({ name: 'GEMINI_API_KEY', key: envGemini });
  if (envGoogle && envGoogle !== envGemini) {
    candidates.push({ name: 'GOOGLE_API_KEY', key: envGoogle });
  }
  return candidates;
};

const isInvalidKeyMessage = message => {
  const lower = String(message || '').toLowerCase();
  return lower.includes('api key not valid') || lower.includes('api_key_invalid');
};

const ensureEnv = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE;
  const geminiKey =
    normalizeKey(process.env.GEMINI_API_KEY) || normalizeKey(process.env.GOOGLE_API_KEY);

  if (!supabaseUrl) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL en las variables de entorno.');
  }

  if (!serviceRole) {
    throw new Error(
      'Configura SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_SERVICE_ROLE) para operaciones de servidor.'
    );
  }

  if (!geminiKey) {
    throw new Error('Configura GEMINI_API_KEY para generar diagnósticos.');
  }

  return { supabaseUrl, serviceRole, geminiKey };
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, { retries = 3, baseDelayMs = 500 } = {}) {
  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 503) {
        if (attempt === retries) {
          const errorBody = await res.text().catch(() => '');
          throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
        }
        lastError = new Error(`Gemini API error: ${res.status}`);
      } else if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
      } else {
        return res;
      }
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
    const jitter = Math.floor(Math.random() * 200);
    const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
    await wait(delay);
    attempt += 1;
  }
  throw lastError || new Error('Unknown fetch error');
}

const getAdminClient = () => {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const { supabaseUrl, serviceRole } = ensureEnv();
  cachedAdminClient = createClient(supabaseUrl, serviceRole, {
    auth: {
      persistSession: false,
    },
  });

  return cachedAdminClient;
};

const normalizePhone = phone => {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
};

const formatRagContext = matches => {
  if (!matches || matches.length === 0) return '';

  return matches
    .map((match, index) => {
      const similarity = match.similarity ? (match.similarity * 100).toFixed(1) : 'N/A';
      const sourceName = match.metadata?.filename || 'fuente desconocida';
      return `#${index + 1} (${similarity}% similitud)\n${match.content}\nFuente: ${sourceName}`;
    })
    .join('\n---\n');
};

const saveRagSources = async (supabase, diagnosisId, ragMatches) => {
  if (!ragMatches || ragMatches.length === 0) return;

  try {
    const sourcesToInsert = ragMatches.map((match, index) => ({
      diagnosis_id: diagnosisId,
      chunk_id: match.id,
      similarity_score: match.similarity || 0,
      chunk_index: index + 1,
    }));

    const { error } = await supabase
      .from('diagnosis_rag_sources')
      .insert(sourcesToInsert);

    if (error) {
      console.error('Error guardando fuentes RAG:', error);
    }
  } catch (error) {
    console.error('Error inesperado guardando fuentes RAG:', error);
  }
};

const extractGeminiSections = text => {
  if (!text || typeof text !== 'string') {
    return { metadata: null, markdown: '' };
  }

  const codeBlockRegex = /```json([\s\S]*?)```/i;
  const match = text.match(codeBlockRegex);
  let jsonString = null;
  let markdownPart = text;

  if (match) {
    jsonString = match[1].trim();
    markdownPart = text.replace(match[0], '').trim();
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.indexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = text.slice(firstBrace, lastBrace + 1).trim();
      markdownPart = text.slice(lastBrace + 1).trim();
    }
  }

  let metadata = null;
  if (jsonString) {
    try {
      metadata = JSON.parse(jsonString);
    } catch (err) {
      console.warn('No se pudo parsear el bloque JSON de Gemini:', err);
    }
  }

  return { metadata, markdown: markdownPart };
};

const callGemini = async ({ cultivoName, notes, ragContext, base64Image, mimeType }) => {
  const { geminiKey } = ensureEnv();
  const candidates = getGeminiKeyCandidates();
  const fallbackKey = candidates.find(candidate => candidate.key !== geminiKey)?.key || null;
  const prompt = buildGeminiPrompt({
    cultivoName,
    ragContext,
    notes,
  });

  if (isDebugEnabled()) {
    console.log('[gemini] generateContent request', {
      model: 'gemini-3-flash-preview',
      promptChars: prompt.length,
      ragChars: ragContext?.length || 0,
      notesChars: notes?.length || 0,
      mimeType,
      imageBase64Chars: base64Image?.length || 0,
      keyFingerprint: geminiKey ? `***${geminiKey.slice(-5)}` : null,
      fallbackKeyFingerprint: fallbackKey ? `***${fallbackKey.slice(-5)}` : null,
    });
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

  const makeOptions = apiKey => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 1.0,
        maxOutputTokens: 3200,
      },
    }),
    cache: 'no-store',
  });

  let response;
  try {
    response = await fetchWithRetry(url, makeOptions(geminiKey), {
      retries: 3,
      baseDelayMs: 600,
    });
  } catch (error) {
    const msg = String(error?.message || '');
    if (fallbackKey && isInvalidKeyMessage(msg)) {
      if (isDebugEnabled()) {
        console.warn('[gemini] API_KEY_INVALID, reintentando con key alterna', {
          from: `***${geminiKey.slice(-5)}`,
          to: `***${fallbackKey.slice(-5)}`,
        });
      }
      response = await fetchWithRetry(url, makeOptions(fallbackKey), {
        retries: 3,
        baseDelayMs: 600,
      });
    } else {
      throw error;
    }
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
  }

  const payload = await response.json();
  const textResponse = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('Gemini no devolvió una respuesta legible.');
  }

  const { metadata, markdown } = extractGeminiSections(textResponse);

  const confidenceScore = metadata?.confidence_score ?? 0;
  const normalizedConfidence =
    typeof confidenceScore === 'number' ? Math.max(0, Math.min(confidenceScore, 100)) / 100 : 0;

  return {
    diagnosis_md: markdown?.trim() || metadata?.diagnosis_title || 'Diagnóstico no disponible.',
    confidence: normalizedConfidence,
    needs_additional_image: metadata ? metadata.is_conclusive === false : true,
    urgency_level: metadata?.urgency_level || 'Media',
    recommendations: metadata?.recommendations || [],
    metadata,
    raw_text: textResponse,
  };
};

const buildVerificationPrompt = (diseaseName, userSymptoms, canonicalSymptoms) => {
  return `
Eres un asistente experto en fitopatología. Tu tarea es verificar si los síntomas descritos por un usuario coinciden con la descripción canónica de una enfermedad.

Enfermedad a verificar:
${diseaseName}

Síntomas descritos por el usuario:
---
${userSymptoms}
---

Descripción canónica de la enfermedad (extraída de la base de conocimiento):
---
${canonicalSymptoms}
---

Instrucciones:
1. Compara cuidadosamente los síntomas del usuario con la descripción canónica.
2. Determina si hay una coincidencia suficientemente fuerte para confirmar el diagnóstico.
3. Responde únicamente con un objeto JSON válido, sin texto adicional ni markdown.
4. El objeto JSON debe tener la siguiente estructura:
   {
     "is_match": boolean,
     "confidence": number,
     "reasoning": "string",
     "source_document": "string"
   }
`;
};

const callGeminiForVerification = async ({
  geminiKey,
  diseaseName,
  userSymptoms,
  canonicalSymptoms,
  sourceDocument,
}) => {
  const prompt = buildVerificationPrompt(diseaseName, userSymptoms, canonicalSymptoms);
  const candidates = getGeminiKeyCandidates();
  const fallbackKey = candidates.find(candidate => candidate.key !== geminiKey)?.key || null;

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

  const makeOptions = apiKey => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
      },
    }),
    cache: 'no-store',
  });

  let responseWithRetry;
  try {
    responseWithRetry = await fetchWithRetry(url, makeOptions(geminiKey), {
      retries: 3,
      baseDelayMs: 500,
    });
  } catch (error) {
    const msg = String(error?.message || '');
    if (fallbackKey && isInvalidKeyMessage(msg)) {
      if (isDebugEnabled()) {
        console.warn('[gemini] API_KEY_INVALID (verification), reintentando con key alterna', {
          from: `***${String(geminiKey).slice(-5)}`,
          to: `***${fallbackKey.slice(-5)}`,
        });
      }
      responseWithRetry = await fetchWithRetry(url, makeOptions(fallbackKey), {
        retries: 3,
        baseDelayMs: 500,
      });
    } else {
      throw error;
    }
  }

  if (!responseWithRetry.ok) {
    const errorBody = await responseWithRetry.text();
    console.error(
      `Gemini verification API error: ${responseWithRetry.status} - ${redactString(errorBody)}`
    );
    return null;
  }

  const payload = await responseWithRetry.json();
  const textResponse = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    console.error('Gemini (verification) no devolvió una respuesta legible.');
    return null;
  }

  try {
    const verificationData = JSON.parse(textResponse);
    return {
      is_confirmed: verificationData.is_match && verificationData.confidence > 0.7,
      confirmation_source: verificationData.is_match ? sourceDocument || diseaseName : null,
      confirmation_details: verificationData.reasoning || '',
    };
  } catch (error) {
    console.error('Error parseando respuesta de verificación de Gemini:', error);
    return null;
  }
};

async function verifyDiagnosisWithRAG(supabase, diseaseName, userSymptoms, geminiKey) {
  const diseaseEmbedding = await generateEmbedding(diseaseName);

  const { data: matches, error: ragError } = await supabase.rpc('match_knowledge', {
    query_embedding: diseaseEmbedding,
    match_threshold: 0.6,
    match_count: 1,
  });

  if (ragError || !matches || matches.length === 0) {
    console.error('Error en RAG de verificación o sin coincidencias:', ragError?.message);
    return {
      is_confirmed: false,
      confirmation_source: null,
      confirmation_details: 'No se encontró descripción en la base de conocimiento.',
    };
  }

  const canonicalSymptomData = matches[0];
  const sourceDocument = canonicalSymptomData.metadata?.filename || 'Fuente desconocida';

  let verificationResult = null;
  try {
    verificationResult = await callGeminiForVerification({
      geminiKey,
      diseaseName,
      userSymptoms,
      canonicalSymptoms: canonicalSymptomData.content,
      sourceDocument,
    });
  } catch (error) {
    console.error('Error llamando a Gemini para verificación:', error?.message || error);
    verificationResult = null;
  }

  if (!verificationResult) {
    return {
      is_confirmed: false,
      confirmation_source: null,
      confirmation_details: 'Falló la llamada de verificación al LLM.',
    };
  }

  return verificationResult;
}

const uploadImage = async (supabase, buffer, mimeType, userId) => {
  try {
    const extension = mimeType?.split('/')?.[1] || 'jpg';
    const path = `diagnoses/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from('diagnosis-images')
      .upload(path, buffer, { upsert: false, contentType: mimeType });

    if (error) {
      console.warn('No se pudo subir la imagen a Storage:', error.message);
      return null;
    }

    const { supabaseUrl } = ensureEnv();
    return `${supabaseUrl}/storage/v1/object/public/diagnosis-images/${path}`;
  } catch (error) {
    console.warn('Error inesperado subiendo imagen:', error);
    return null;
  }
};

export async function findProfileByPhone(phone) {
  const supabase = getAdminClient();
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return { data: null, error: 'Número de teléfono inválido.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, credits_remaining, phone')
    .eq('phone', normalized)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { data: null, error: null };
    }

    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function runDiagnosis({
  userId,
  cultivoName,
  notes,
  gpsLat = null,
  gpsLong = null,
  imageBuffer,
  mimeType = 'image/jpeg',
  source = 'web',
}) {
  if (!userId) {
    return { error: 'El usuario es obligatorio.' };
  }

  if (!cultivoName) {
    return { error: 'El nombre del cultivo es obligatorio.' };
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    return { error: 'La imagen es obligatoria para generar el diagnóstico.' };
  }

  const supabase = getAdminClient();

  const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedMime.has(mimeType)) {
    return {
      error: 'Formato de imagen no soportado. Usa JPG, PNG o WEBP.',
      statusCode: 400,
    };
  }
  if (imageBuffer.length > 10 * 1024 * 1024) {
    return {
      error: 'La imagen es demasiado grande (>10MB). Comprime o toma otra foto.',
      statusCode: 400,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return { error: 'No se pudo obtener el perfil del usuario.', statusCode: 404 };
  }

  if ((profile.credits_remaining || 0) <= 0) {
    return {
      error: 'No tienes créditos disponibles. Contacta al administrador.',
      statusCode: 402,
    };
  }

  const userText = `Cultivo: ${cultivoName}\nNotas: ${notes || 'Sin notas adicionales'}`;
  const embedding = await generateEmbedding(userText);

  const { data: ragMatches, error: ragError } = await supabase.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.55,
    match_count: 5,
  });

  if (ragError) {
    console.error('Error ejecutando match_knowledge:', ragError);
  }

  const ragContext = formatRagContext(ragMatches);
  const base64Image = imageBuffer.toString('base64');

  let geminiResult;
  try {
    geminiResult = await callGemini({
      cultivoName,
      notes,
      ragContext,
      base64Image,
      mimeType,
    });
  } catch (err) {
    const msg = String(err.message || '');
    if (isDebugEnabled()) {
      console.error('[gemini] generateContent failed', { message: msg });
    }
    const statusMatch = msg.match(/Gemini API error:\s+(\d+)/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : null;
    if (msg.toLowerCase().includes('api key not valid') || msg.toLowerCase().includes('api_key_invalid')) {
      return {
        error: 'La clave de IA no es válida. Verifica GEMINI_API_KEY o GOOGLE_API_KEY.',
        statusCode: 400,
      };
    }
    if (msg.includes('429') || msg.toLowerCase().includes('resource_exhausted')) {
      return {
        error: 'Demasiadas solicitudes al servicio de IA. Intenta nuevamente en unos minutos.',
        statusCode: 429,
      };
    }
    if (msg.includes('503') || msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('overloaded')) {
      return {
        error: 'El servicio de IA está temporalmente sobrecargado. Intenta nuevamente en unos minutos.',
        statusCode: 503,
      };
    }
    if (msg.includes('401') || msg.includes('403')) {
      return {
        error: 'La clave de IA es inválida o no tiene permisos. Verifica GEMINI_API_KEY.',
        statusCode: 500,
      };
    }
    if (statusCode === 400) {
      return {
        error: 'Solicitud inválida al servicio de IA. Verifica la imagen y los datos enviados.',
        statusCode: 400,
      };
    }
    if (statusCode === 404) {
      return {
        error: 'El modelo solicitado no está disponible. Intenta más tarde.',
        statusCode: 404,
      };
    }
    if (statusCode === 500) {
      return {
        error: 'Fallo interno del proveedor de IA. Intenta más tarde.',
        statusCode: 500,
      };
    }
    return {
      error: 'No se pudo generar el diagnóstico con el servicio de IA. Intenta más tarde.',
      statusCode: 500,
    };
  }

  const confidence =
    typeof geminiResult.confidence === 'number' ? geminiResult.confidence : 0;

  if (confidence < MIN_CONFIDENCE || geminiResult.needs_additional_image) {
    return {
      needsBetterPhoto: true,
      message:
        'La imagen no fue concluyente (confianza < 70%). Por favor envía otra foto más clara.',
    };
  }

  const { geminiKey } = ensureEnv();

  let verificationResult = {
    is_confirmed: false,
    confirmation_source: null,
    confirmation_details: '',
  };

  const diseaseNameForVerification =
    geminiResult.metadata?.diagnosis_title || cultivoName;

  if (diseaseNameForVerification) {
    try {
      verificationResult = await verifyDiagnosisWithRAG(
        supabase,
        diseaseNameForVerification,
        userText,
        geminiKey
      );
    } catch (error) {
      console.error('Error en verificación con RAG:', error?.message || error);
      verificationResult = {
        is_confirmed: false,
        confirmation_source: null,
        confirmation_details: 'Falló la verificación; se guardó el diagnóstico sin confirmar.',
      };
    }
  }

  const imageUrl = await uploadImage(supabase, imageBuffer, mimeType, userId);

  if (!imageUrl) {
    return {
      error:
        'No se pudo subir la imagen del diagnóstico. Intenta nuevamente más tarde o contacta al administrador.',
      statusCode: 500,
    };
  }

  const diagnosisPayload = {
    user_id: userId,
    image_url: imageUrl,
    cultivo_name: cultivoName,
    ai_diagnosis_md:
      geminiResult.diagnosis_md ||
      geminiResult.reasoning_summary ||
      'Diagnóstico no disponible.',
    confidence_score: confidence,
    gps_lat: gpsLat ? parseFloat(gpsLat) : null,
    gps_long: gpsLong ? parseFloat(gpsLong) : null,
    status: 'pending',
    source,
    expert_notes: null,
    is_confirmed: verificationResult.is_confirmed,
    confirmation_source: verificationResult.confirmation_source,
    llm_reasoning: geminiResult.raw_text || null, // Cadena de razonamiento completa del LLM
  };

  const { data: insertedDiagnosis, error: insertError } = await supabase
    .from('diagnoses')
    .insert(diagnosisPayload)
    .select()
    .single();

  // Guardar trazabilidad RAG
  if (insertedDiagnosis && ragMatches && ragMatches.length > 0) {
    await saveRagSources(supabase, insertedDiagnosis.id, ragMatches);
  }

  if (insertError) {
    console.error('Error guardando diagnóstico:', insertError);
    return {
      error: 'No se pudo guardar el diagnóstico. Intenta nuevamente más tarde.',
      statusCode: 500,
    };
  }

  const newCreditBalance = Math.max(0, (profile.credits_remaining || 1) - 1);
  const { error: creditError } = await supabase
    .from('profiles')
    .update({ credits_remaining: newCreditBalance })
    .eq('id', userId);

  if (creditError) {
    console.error('Error actualizando créditos:', creditError);
  }

  return {
    success: true,
    diagnosis: insertedDiagnosis,
    remainingCredits: newCreditBalance,
    recommendations: geminiResult.recommendations || [],
    ragUsage: {
      sourcesCount: ragMatches ? ragMatches.length : 0,
      avgSimilarity: ragMatches ? ragMatches.reduce((sum, m) => sum + (m.similarity || 0), 0) / ragMatches.length : 0,
      maxSimilarity: ragMatches ? Math.max(...ragMatches.map(m => m.similarity || 0)) : 0,
      sources: ragMatches ? ragMatches.map((match, index) => ({
        index: index + 1,
        similarity: match.similarity || 0,
        filename: match.metadata?.filename || 'desconocido',
        content: match.content.substring(0, 200) + '...'
      })) : []
    },
    raw: geminiResult,
  };
}

export { ensureEnv };
