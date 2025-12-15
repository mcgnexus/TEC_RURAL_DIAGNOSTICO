import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './embeddingService.js';
import { buildGeminiPrompt } from './prompts/geminiMasterPrompt.js';

const MIN_CONFIDENCE = 0.7;
let cachedAdminClient = null;

const ensureEnv = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE;
  const geminiKey = process.env.GEMINI_API_KEY;

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
  const prompt = buildGeminiPrompt({
    cultivoName,
    ragContext,
    notes,
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          topK: 40,
          topP: 0.9,
        },
      }),
    }
  );

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

  const geminiResult = await callGemini({
    cultivoName,
    notes,
    ragContext,
    base64Image,
    mimeType,
  });

  const confidence =
    typeof geminiResult.confidence === 'number' ? geminiResult.confidence : 0;

  if (confidence < MIN_CONFIDENCE || geminiResult.needs_additional_image) {
    return {
      needsBetterPhoto: true,
      message:
        'La imagen no fue concluyente (confianza < 70%). Por favor envía otra foto más clara.',
    };
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
  };

  const { data: insertedDiagnosis, error: insertError } = await supabase
    .from('diagnoses')
    .insert(diagnosisPayload)
    .select()
    .single();

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
    raw: geminiResult,
  };
}

export { ensureEnv };
