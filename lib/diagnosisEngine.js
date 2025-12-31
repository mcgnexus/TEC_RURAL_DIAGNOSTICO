import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import { generateEmbedding } from './embeddingService.js';
import {
  buildGeminiObservationPrompt,
  buildGeminiDiagnosisPrompt,
} from './prompts/geminiMasterPrompt.js';
import { callGeminiApi } from './gemini.js';
import { redactString } from './logging.js';

const MIN_FINAL_SCORE = 0.7;
const MIN_IMAGE_QUALITY_SCORE = 0.4;
const MIN_VISION_CONFIDENCE = 0.2;
const MIN_RAG_NAME_MATCHES = 1;
const MIN_RAG_SCORE_FOR_SUPPORT = 0.6;
const SCORE_WEIGHTS = { vision: 0.5, rag: 0.35, image: 0.15 };
const QUALITY_SCORES = { alta: 1, media: 0.6, baja: 0.2 };
const URGENCY_LEVELS = new Set(['Baja', 'Media', 'Alta', 'Muy Alta']);

let cachedAdminClient = null;

const isDebugEnabled = () =>
  process.env.DIAGNOSE_DEBUG === '1' || process.env.NEXT_PUBLIC_DIAGNOSE_DEBUG === '1';

export const ensureEnv = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRole) {
    throw new Error(
      'Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.'
    );
  }
  return { supabaseUrl, serviceRole };
};

const getAdminClient = () => {
  if (cachedAdminClient) return cachedAdminClient;
  const { supabaseUrl, serviceRole } = ensureEnv();
  cachedAdminClient = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
  return cachedAdminClient;
};

const clamp = (value, min = 0, max = 1) => {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
};

const parseJsonFromGeminiText = text => {
  if (!text || typeof text !== 'string') return null;
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const rawSlice =
    firstBrace !== -1 && lastBrace > firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate.slice(firstBrace);
  const slice = rawSlice.trim();
  try {
    return JSON.parse(slice);
  } catch (err) {
    const repaired = repairJsonCandidate(slice);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch (repairErr) {
        console.warn('No se pudo parsear JSON reparado:', repairErr, {
          text: redactString(repaired),
        });
      }
    }
    const trimmed = tryParseByLineTrim(slice);
    if (trimmed) return trimmed;
    console.warn('No se pudo parsear JSON de Gemini:', err, { text: redactString(slice) });
    return null;
  }
};

const repairJsonCandidate = value => {
  if (!value || typeof value !== 'string') return '';
  let text = value.trim();
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    if (start === -1) return '';
    text = text.slice(start);
  }
  const totalQuotes = (text.match(/"/g) || []).length;
  if (totalQuotes % 2 !== 0) {
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline !== -1) {
      text = text.slice(0, lastNewline).trim();
    }
  }
  text = text.replace(/,\s*([}\]])/g, '$1');
  text = text.replace(/,\s*$/g, '');
  const openBraces = (text.match(/{/g) || []).length;
  const closeBraces = (text.match(/}/g) || []).length;
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/]/g) || []).length;
  if (closeBrackets < openBrackets) {
    text += ']'.repeat(openBrackets - closeBrackets);
  }
  if (closeBraces < openBraces) {
    text += '}'.repeat(openBraces - closeBraces);
  }
  return text;
};

const tryParseByLineTrim = value => {
  if (!value || typeof value !== 'string') return null;
  const lines = value.split('\n');
  for (let i = lines.length; i > 0; i -= 1) {
    const candidate = lines.slice(0, i).join('\n').trim();
    if (!candidate) continue;
    const repaired = repairJsonCandidate(candidate);
    if (!repaired) continue;
    try {
      return JSON.parse(repaired);
    } catch {
      // continue
    }
  }
  return null;
};

const normalizeQualityValue = value => {
  const val = String(value || '').toLowerCase();
  if (val.includes('alta')) return 'alta';
  if (val.includes('media')) return 'media';
  if (val.includes('baja')) return 'baja';
  return 'media';
};

const normalizeList = arr =>
  Array.isArray(arr)
    ? arr
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, 8)
    : [];

const stripAccents = value =>
  typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : '';

const normalizeNameForMatch = value => {
  const normalized = stripAccents(String(value || '').toLowerCase());
  return normalized
    .replace(/^(posible|probable|sospecha de|sospechoso de)\s+/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeObservation = (input, cultivoName) => {
  const sintomas = normalizeList(input?.sintomas);
  const hallazgosVisuales = normalizeList(input?.hallazgos_visuales);
  const riesgosVisibles = normalizeList(input?.riesgos_visibles);
  const calidad = input?.calidad_imagen || {};
  const nitidez = normalizeQualityValue(calidad.nitidez);
  const cobertura = normalizeQualityValue(calidad.cobertura);
  const diagnosisTitlePrelim = (input?.diagnosis_title_prelim || '').toString().trim();
  const diagnosisAliases = normalizeList(input?.diagnosis_aliases);
  const hasConfidence = typeof input?.vision_confidence === 'number';
  const baseConfidence = hasConfidence ? input?.vision_confidence : diagnosisTitlePrelim ? 60 : 0;
  const visionConfidence = clamp(baseConfidence ?? 0, 0, 100);
  const descripcionVisual = (input?.descripcion_visual || '').toString().trim();

  return {
    cultivoDeclarado: cultivoName?.trim() || '',
    cultivoDetectado: (input?.cultivo_detectado || 'desconocido').toString().trim() || 'desconocido',
    cultivoConfianza: clamp(input?.cultivo_confianza ?? 0, 0, 100),
    coincideCultivo:
      input?.coincide_cultivo === true
        ? true
        : input?.coincide_cultivo === false
          ? false
          : null,
    sintomas,
    hallazgosVisuales,
    riesgosVisibles,
    calidadImagen: {
      nitidez,
      cobertura,
      notas: calidad.notas?.toString().trim() || '',
    },
    diagnosisTitlePrelim: diagnosisTitlePrelim || 'desconocido',
    diagnosisAliases,
    visionConfidence,
    descripcionVisual,
  };
};

const formatRagContext = matches => {
  if (!matches || matches.length === 0) return 'Sin contexto tecnico disponible.';
  return matches
    .map((match, index) => {
      const similarity = match.similarity ? (match.similarity * 100).toFixed(1) : 'N/A';
      return `#${index + 1} (Similitud: ${similarity}%)\n${match.content}`;
    })
    .join('\n---\n');
};

const computeRagStats = matches => {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { score: 0, avgSimilarity: 0, minSimilarity: 0, count: 0 };
  }
  const sims = matches
    .map(m => (typeof m.similarity === 'number' ? m.similarity : 0))
    .filter(s => s > 0);
  if (sims.length === 0) return { score: 0, avgSimilarity: 0, minSimilarity: 0, count: 0 };
  const avg = sims.reduce((acc, val) => acc + val, 0) / sims.length;
  const min = Math.min(...sims);
  return { score: clamp(avg, 0, 1), avgSimilarity: avg, minSimilarity: min, count: sims.length };
};

const normalizeDiagnosisName = normalizeNameForMatch;

const computeNameSimilarity = (a, b) => {
  const tokensA = new Set(normalizeDiagnosisName(a).split(' ').filter(Boolean));
  const tokensB = new Set(normalizeDiagnosisName(b).split(' ').filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) intersection += 1;
  });
  const union = tokensA.size + tokensB.size - intersection;
  return union ? intersection / union : 0;
};

const extractRagDiagnosisCandidates = matches => {
  const candidates = [];
  if (!Array.isArray(matches)) return candidates;
  const nameKeys = ['disease', 'disease_name', 'diagnosis', 'diagnosis_name', 'title', 'name'];
  const patterns = [
    /(?:diagn[oó]stico|enfermedad|nombre(?:\s+comun)?|nombre(?:\s+cientifico)?|pat[oó]geno)\s*[:\-]\s*(.+)$/i,
  ];
  matches.forEach(match => {
    const meta = match?.metadata || {};
    nameKeys.forEach(key => {
      const value = meta?.[key];
      if (typeof value === 'string' && value.trim()) {
        candidates.push(value.trim());
      }
    });
    const content = String(match?.content || '');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      patterns.forEach(pattern => {
        const hit = trimmed.match(pattern);
        if (hit?.[1]) {
          const candidate = hit[1].trim();
          if (candidate.length > 3 && candidate.length < 90) {
            candidates.push(candidate);
          }
        }
      });
    });
  });
  return Array.from(new Set(candidates));
};

const computeRagNameSupport = (matches, diagnosisTitle, aliases = []) => {
  const candidates = [diagnosisTitle, ...aliases].map(normalizeDiagnosisName).filter(Boolean);
  if (!candidates.length || !Array.isArray(matches) || matches.length === 0) {
    return { hits: 0, ratio: 0, avgSimilarity: 0 };
  }

  const nameKeys = ['disease', 'disease_name', 'diagnosis', 'diagnosis_name', 'title', 'name'];
  const matched = matches.filter(match => {
    const content = normalizeNameForMatch(match?.content || '');
    if (candidates.some(candidate => content.includes(candidate))) return true;
    const meta = match?.metadata || {};
    return nameKeys.some(key =>
      candidates.some(candidate =>
        normalizeNameForMatch(meta?.[key] || '').includes(candidate)
      )
    );
  });

  const sims = matched
    .map(m => (typeof m.similarity === 'number' ? m.similarity : 0))
    .filter(s => s > 0);
  const avg = sims.length ? sims.reduce((acc, val) => acc + val, 0) / sims.length : 0;
  const ratio = matches.length ? matched.length / matches.length : 0;

  return { hits: matched.length, ratio, avgSimilarity: avg };
};

const computeRagDiagnosisMatch = (matches, diagnosisTitle, aliases = []) => {
  const ragCandidates = extractRagDiagnosisCandidates(matches);
  if (!ragCandidates.length) {
    return { candidate: '', score: 0 };
  }
  const visionNames = [diagnosisTitle, ...aliases].filter(Boolean);
  let bestCandidate = '';
  let bestScore = 0;
  ragCandidates.forEach(candidate => {
    visionNames.forEach(name => {
      const score = computeNameSimilarity(candidate, name);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    });
  });
  return { candidate: bestCandidate, score: bestScore };
};

const tokenizeText = text =>
  normalizeNameForMatch(text)
    .split(' ')
    .map(token => {
      const trimmed = token.trim();
      if (trimmed.endsWith('s') && trimmed.length > 4) return trimmed.slice(0, -1);
      return trimmed;
    })
    .filter(token => token.length > 2);

const computeRagSymptomSupport = (matches, sintomas = []) => {
  if (!Array.isArray(matches) || matches.length === 0 || !Array.isArray(sintomas)) {
    return { ratio: 0, matched: [] };
  }
  const ragText = matches
    .slice(0, 3)
    .map(match => match?.content || '')
    .join(' ');
  const ragTokensList = tokenizeText(ragText);
  const ragTokens = new Set(ragTokensList);
  const matched = [];
  const total = sintomas.length;
  if (!total) return { ratio: 0, matched: [] };

  sintomas.forEach(symptom => {
    const tokens = tokenizeText(symptom);
    if (!tokens.length) return;
    let hits = 0;
    tokens.forEach(token => {
      if (ragTokens.has(token)) {
        hits += 1;
        return;
      }
      if (ragTokensList.some(ragToken => ragToken.includes(token) || token.includes(ragToken))) {
        hits += 1;
      }
    });
    const coverage = hits / tokens.length;
    if (coverage >= 0.5 || (hits >= 1 && tokens.some(token => token.length >= 5))) {
      matched.push(symptom);
    }
  });

  return {
    ratio: total ? matched.length / total : 0,
    matched,
  };
};

const fingerprintRagMatches = matches => {
  const hash = createHash('sha256');
  if (!Array.isArray(matches) || matches.length === 0) {
    hash.update('no-rag');
    return hash.digest('hex');
  }
  matches.slice(0, 5).forEach(match => {
    hash.update(String(match.id || ''));
    hash.update(String(match.similarity ?? ''));
    hash.update(String(match.content || '').slice(0, 200));
  });
  return hash.digest('hex');
};

const buildRequestHash = ({ imageBuffer, cultivoName, notes, observation, ragFingerprint }) => {
  const hash = createHash('sha256');
  hash.update(imageBuffer);
  hash.update(cultivoName || '');
  hash.update(notes || '');
  hash.update(JSON.stringify(observation || {}));
  hash.update(ragFingerprint || '');
  return hash.digest('hex');
};

const uploadImage = async (supabase, buffer, mimeType, userId) => {
  try {
    const extension = mimeType?.split('/')[1] || 'jpg';
    const path = `diagnoses/${userId}/${randomUUID()}.${extension}`;
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

async function deductCredit(supabase, userId, currentCredits) {
  const newCreditBalance = Math.max(0, (currentCredits || 1) - 1);
  const { error } = await supabase
    .from('profiles')
    .update({ credits_remaining: newCreditBalance })
    .eq('id', userId);

  if (error) {
    console.error('Error actualizando creditos:', error);
  }
  return newCreditBalance;
}

const normalizeReportSection = report => {
  const safeReport = report && typeof report === 'object' ? report : {};
  return {
    descripcion_visual: (safeReport.descripcion_visual || '').toString().trim(),
    por_que: (safeReport.por_que || '').toString().trim(),
    acciones_ecologicas: normalizeList(safeReport.acciones_ecologicas),
    acciones_quimicas: normalizeList(safeReport.acciones_quimicas),
    recomendaciones: normalizeList(safeReport.recomendaciones),
    referencias_rag: normalizeList(safeReport.referencias_rag),
  };
};

const normalizeUrgency = value => {
  const raw = (value || '').toString().trim();
  const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return URGENCY_LEVELS.has(normalized) ? normalized : 'Media';
};

const normalizeDiagnosisMetadata = meta => {
  if (!meta) return null;
  const confidenceRaw =
    meta.confidence_score ?? meta.confidence ?? meta.confidenceScore ?? meta.score ?? 0;
  const confidenceScore = typeof confidenceRaw === 'number' ? clamp(confidenceRaw, 0, 100) : 0;
  const titleRaw = meta.diagnosis_title ?? meta.diagnosis ?? meta.title ?? '';
  const diagnosisTitle = titleRaw.toString().trim() || 'Diagnostico no disponible';
  const isConclusive =
    meta.is_conclusive === true
      ? true
      : meta.is_conclusive === false
        ? false
        : confidenceScore >= 70;

  return {
    confidence_score: confidenceScore,
    is_conclusive: isConclusive,
    diagnosis_title: diagnosisTitle,
    urgency_level: normalizeUrgency(meta.urgency_level ?? meta.urgency ?? meta.urgencyLevel),
    supporting_points: normalizeList(meta.supporting_points),
  };
};

const buildRagQueryText = ({ cultivoName, observation, notes }) => {
  const lines = [];
  if (cultivoName) lines.push(`Cultivo declarado: ${cultivoName}`);
  if (observation?.cultivoDetectado) lines.push(`Cultivo detectado: ${observation.cultivoDetectado}`);
  if (observation?.diagnosisTitlePrelim && observation.diagnosisTitlePrelim !== 'desconocido') {
    lines.push(`Diagnostico preliminar: ${observation.diagnosisTitlePrelim}`);
  }
  if (observation?.sintomas?.length) lines.push(`Sintomas: ${observation.sintomas.join('; ')}`);
  if (observation?.riesgosVisibles?.length)
    lines.push(`Riesgos visibles: ${observation.riesgosVisibles.join('; ')}`);
  if (notes) lines.push(`Notas: ${notes}`);
  return lines.join('\n');
};

const buildNeedsBetterPhotoMessage = (observation, reason = null) => {
  if (observation?.coincideCultivo === false) {
    return 'La imagen no coincide con el cultivo declarado. Envía una foto del cultivo correcto.';
  }
  if (observation?.calidadImagen?.nitidez === 'baja') {
    return 'La imagen tiene nitidez baja. Envía una foto más cercana y enfocada.';
  }
  if (reason === 'rag-no-support') {
    return 'El diagnostico preliminar no coincide con el RAG. Envia otra foto o agrega sintomas/condiciones (clima, riego, parte afectada).';
  }
  if (reason === 'low-evidence') {
    return 'La evidencia visual es parcial y el RAG no confirma el diagnostico. Agrega sintomas, etapa del cultivo o condiciones de riego/clima.';
  }
  return 'La imagen no fue concluyente o la confianza es baja. Por favor envía otra foto más clara.';
};

const imageQualityScore = observation =>
  QUALITY_SCORES[observation?.calidadImagen?.nitidez] ?? QUALITY_SCORES.media;

const callGeminiObservation = async ({ base64Image, mimeType, cultivoName, notes }) => {
  const prompt = buildGeminiObservationPrompt({ cultivoName, notes });
  const observationSchema = {
    type: 'OBJECT',
    properties: {
      cultivo_detectado: { type: 'STRING' },
      cultivo_confianza: { type: 'NUMBER' },
      coincide_cultivo: { type: 'BOOLEAN' },
      sintomas: { type: 'ARRAY', items: { type: 'STRING' } },
      hallazgos_visuales: { type: 'ARRAY', items: { type: 'STRING' } },
      descripcion_visual: { type: 'STRING' },
      calidad_imagen: {
        type: 'OBJECT',
        properties: {
          nitidez: { type: 'STRING' },
          cobertura: { type: 'STRING' },
          notas: { type: 'STRING' },
        },
        required: ['nitidez', 'cobertura'],
      },
      riesgos_visibles: { type: 'ARRAY', items: { type: 'STRING' } },
      diagnosis_title_prelim: { type: 'STRING' },
      vision_confidence: { type: 'NUMBER' },
    },
    required: [
      'cultivo_detectado',
      'cultivo_confianza',
      'coincide_cultivo',
      'sintomas',
      'hallazgos_visuales',
      'descripcion_visual',
      'calidad_imagen',
      'riesgos_visibles',
      'diagnosis_title_prelim',
      'vision_confidence',
    ],
  };
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ inline_data: { mime_type: mimeType, data: base64Image } }, { text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 8,
      topP: 0.8,
      maxOutputTokens: 2400,
      responseMimeType: 'application/json',
      responseSchema: observationSchema,
    },
  };

  const data = await callGeminiApi(payload, { debug: isDebugEnabled() });
  const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!textResponse) {
    throw new Error('Gemini no devolvio observaciones legibles.');
  }
  const parsed = parseJsonFromGeminiText(textResponse);
  const observation = normalizeObservation(parsed || {}, cultivoName);
  return { observation, raw_text: textResponse };
};

const callGeminiDiagnosis = async ({
  base64Image,
  mimeType,
  cultivoName,
  ragContext,
  notes,
  sintomas,
  diagnosisTitlePrelim,
  finalConfidencePercent,
  cultivoDetectado,
  coincideCultivo,
  riesgosVisibles,
  descripcionVisual,
  hallazgosVisuales,
  ragDiagnosisCandidate,
  ragNameMatchScore,
  ragSymptomMatchRatio,
  ragMatchedSymptoms,
}) => {
  const diagnosisSchema = {
    type: 'OBJECT',
    properties: {
      confidence_score: { type: 'NUMBER' },
      is_conclusive: { type: 'BOOLEAN' },
      diagnosis_title: { type: 'STRING' },
      urgency_level: { type: 'STRING' },
      supporting_points: { type: 'ARRAY', items: { type: 'STRING' } },
      report: {
        type: 'OBJECT',
        properties: {
          descripcion_visual: { type: 'STRING' },
          por_que: { type: 'STRING' },
          acciones_ecologicas: { type: 'ARRAY', items: { type: 'STRING' } },
          acciones_quimicas: { type: 'ARRAY', items: { type: 'STRING' } },
          recomendaciones: { type: 'ARRAY', items: { type: 'STRING' } },
          referencias_rag: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: [
          'descripcion_visual',
          'por_que',
          'acciones_ecologicas',
          'acciones_quimicas',
          'recomendaciones',
          'referencias_rag',
        ],
      },
    },
    required: [
      'confidence_score',
      'is_conclusive',
      'diagnosis_title',
      'urgency_level',
      'supporting_points',
      'report',
    ],
  };
  const prompt = buildGeminiDiagnosisPrompt({
    cultivoName,
    ragContext,
    notes,
    sintomas,
    diagnosisTitlePrelim,
    finalConfidencePercent,
    cultivoDetectado,
    coincideCultivo,
    riesgosVisibles,
    descripcionVisual,
    hallazgosVisuales,
    ragDiagnosisCandidate,
    ragNameMatchScore,
    ragSymptomMatchRatio,
    ragMatchedSymptoms,
  });

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ inline_data: { mime_type: mimeType, data: base64Image } }, { text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      topK: 10,
      topP: 0.85,
      maxOutputTokens: 3800,
      responseMimeType: 'application/json',
      responseSchema: diagnosisSchema,
    },
  };

  const data = await callGeminiApi(payload, { debug: isDebugEnabled() });
  const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!textResponse) {
    throw new Error('Gemini no devolvio un diagnostico legible.');
  }

  const parsed = parseJsonFromGeminiText(textResponse);
  const normalizedMetadata =
    normalizeDiagnosisMetadata(parsed) || {
      confidence_score: 0,
      is_conclusive: false,
      diagnosis_title: 'Diagnostico no disponible',
      urgency_level: 'Media',
      supporting_points: [],
    };
  const normalizedReport = normalizeReportSection(parsed?.report);

  return {
    metadata: normalizedMetadata,
    report: normalizedReport,
    raw_text: textResponse,
  };
};

const computeFinalScore = ({ visionConfidence, ragScore, imgScore }) =>
  SCORE_WEIGHTS.vision * visionConfidence +
  SCORE_WEIGHTS.rag * ragScore +
  SCORE_WEIGHTS.image * imgScore;

const ensureConfidenceInMarkdown = (markdown, diagnosisTitle, confidencePercent) => {
  const confidenceLine = `Certeza del diagnostico: ${confidencePercent}%`;
  const diagnosisLine = `Diagnostico: ${diagnosisTitle || 'Diagnostico no disponible'}`;
  const visualHeader = 'Descripcion visual detallada:';
  const body = typeof markdown === 'string' ? markdown.trim() : '';

  let result = body || diagnosisLine;
  if (!result.toLowerCase().includes('diagnostico:')) {
    result = `${diagnosisLine}\n\n${result}`;
  }
  if (!result.toLowerCase().includes('certeza del diagnostico')) {
    result = `${confidenceLine}\n\n${result}`;
  }
  if (!result.toLowerCase().includes('descripcion visual')) {
    result = `${visualHeader}\n- ${diagnosisTitle || 'Se observan signos compatibles.'}\n\n${result}`;
  }
  return result.trim();
};

const listAsMarkdown = items => {
  if (!Array.isArray(items) || items.length === 0) return '- Sin datos.';
  return items.map(item => `- ${item}`).join('\n');
};

const buildMarkdownFromReport = ({ metadata, report, observation, finalConfidencePercent }) => {
  const diagnosisTitle =
    metadata?.diagnosis_title || observation?.diagnosisTitlePrelim || 'Diagnostico no disponible';
  const urgency = metadata?.urgency_level || 'Media';
  const description =
    report?.descripcion_visual ||
    observation?.descripcionVisual ||
    'Descripcion visual no disponible.';
  const why = report?.por_que || 'Sin explicacion adicional.';
  const eco = listAsMarkdown(report?.acciones_ecologicas);
  const chem = listAsMarkdown(report?.acciones_quimicas);
  const recs = listAsMarkdown(report?.recomendaciones);
  const refs = listAsMarkdown(report?.referencias_rag);
  const support = listAsMarkdown(metadata?.supporting_points);

  return [
    `Diagnostico: ${diagnosisTitle}`,
    `Certeza del diagnostico: ${finalConfidencePercent}%`,
    `Nivel de urgencia: ${urgency}`,
    '',
    'Descripcion visual detallada:',
    description,
    '',
    'Por que (evidencia):',
    why,
    '',
    'Puntos de soporte:',
    support,
    '',
    'Acciones ecologicas:',
    eco,
    '',
    'Acciones quimicas:',
    chem,
    '',
    'Recomendaciones:',
    recs,
    '',
    'Referencias RAG:',
    refs,
  ].join('\n');
};

const estimateTokens = text => {
  const normalized = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 4);
};

const enforceMinimumDetail = (markdown, observation, ragContext, notes) => {
  const minTokens = 1000;
  const text = typeof markdown === 'string' ? markdown.trim() : '';
  if (estimateTokens(text) >= minTokens) return text;

  const extras = [];
  if (observation?.descripcionVisual) {
    extras.push(`Descripcion visual detallada:\n${observation.descripcionVisual}`);
  }
  if (observation?.hallazgosVisuales?.length) {
    extras.push(`Hallazgos visuales:\n- ${observation.hallazgosVisuales.join('\n- ')}`);
  }
  if (observation?.sintomas?.length) {
    extras.push(`Sintomas visibles:\n- ${observation.sintomas.join('\n- ')}`);
  }
  if (notes) {
    extras.push(`Notas del agricultor:\n${notes}`);
  }

  if (!extras.length) return text;
  const extended = `${text}\n\n${extras.join('\n\n')}`.trim();
  return extended;
};

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
  if (!userId) return { error: 'El usuario es obligatorio.' };
  if (!cultivoName) return { error: 'El nombre del cultivo es obligatorio.' };
  if (!imageBuffer) return { error: 'La imagen es obligatoria.' };

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
    return { error: 'No tienes creditos disponibles.', statusCode: 402 };
  }

  const base64Image = imageBuffer.toString('base64');

  // Etapa 1: observaciones y verificacion de cultivo
  let observationResult;
  try {
    observationResult = await callGeminiObservation({
      base64Image,
      mimeType,
      cultivoName,
      notes,
    });
  } catch (err) {
    console.error('[DiagnosisEngine] Error en observacion (etapa 1):', err);
    return { error: `No se pudo analizar la imagen: ${err.message}`, statusCode: 500 };
  }

  const observation = observationResult.observation;
  const imgScore = imageQualityScore(observation);
  const visionScore = clamp((observation.visionConfidence || 0) / 100, 0, 1);
  const normalizedDiagnosisName = normalizeDiagnosisName(observation.diagnosisTitlePrelim);
  const hasPrelimDiagnosis = Boolean(normalizedDiagnosisName);

  const hasVisualSignals =
    (observation.sintomas?.length || 0) >= 2 ||
    (observation.hallazgosVisuales?.length || 0) >= 2 ||
    (observation.descripcionVisual || '').length >= 40;
  if (observation.coincideCultivo === false || (imgScore < MIN_IMAGE_QUALITY_SCORE && !hasVisualSignals)) {
    return {
      needsBetterPhoto: true,
      message: buildNeedsBetterPhotoMessage(observation),
    };
  }
  if (hasPrelimDiagnosis && visionScore < MIN_VISION_CONFIDENCE) {
    return {
      needsBetterPhoto: true,
      message: 'La confianza del diagnostico por vision es baja. Envia una foto mas clara.',
    };
  }

  // RAG dirigido por sintomas
  const queryText = buildRagQueryText({ cultivoName, observation, notes });
  const embedding = await generateEmbedding(queryText);

  const { data: ragMatches, error: ragError } = await supabase.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.55,
    match_count: 5,
  });
  if (ragError) console.error('Error ejecutando match_knowledge:', ragError);

  const ragContext = formatRagContext(ragMatches);
  const ragStats = computeRagStats(ragMatches);
  const ragNameSupport = hasPrelimDiagnosis
    ? computeRagNameSupport(
        ragMatches,
        observation.diagnosisTitlePrelim,
        observation.diagnosisAliases
      )
    : { hits: 0, ratio: 0, avgSimilarity: 0 };
  const ragDiagnosisMatch = computeRagDiagnosisMatch(
    ragMatches,
    observation.diagnosisTitlePrelim,
    observation.diagnosisAliases
  );
  const ragSymptomSupport = computeRagSymptomSupport(ragMatches, observation.sintomas);
  const ragSupportScore = ragNameSupport.hits > 0 || ragSymptomSupport.ratio > 0
    ? clamp(
        ragStats.score * (0.4 + 0.4 * ragNameSupport.ratio + 0.2 * ragSymptomSupport.ratio),
        0,
        1
      )
    : clamp(ragStats.score * 0.7, 0, 1);
  const ragFingerprint = fingerprintRagMatches(ragMatches);

  const finalScore = hasPrelimDiagnosis
    ? computeFinalScore({
        visionConfidence: visionScore,
        ragScore: ragSupportScore,
        imgScore,
      })
    : clamp(ragSupportScore * 0.7 + imgScore * 0.3, 0, 1);

  const ragHasNameSupport = hasPrelimDiagnosis
    ? ragNameSupport.hits >= MIN_RAG_NAME_MATCHES || ragDiagnosisMatch.score >= 0.5
    : true;
  const ragHasSymptomSupport = ragSymptomSupport.ratio >= 0.3;
  const ragHasScoreSupport = ragStats.score >= MIN_RAG_SCORE_FOR_SUPPORT;
  const ragHasAnySupport = ragHasNameSupport || ragHasSymptomSupport || ragHasScoreSupport;
  const isConclusive =
    observation.coincideCultivo !== false &&
    (hasPrelimDiagnosis ? visionScore >= MIN_VISION_CONFIDENCE : true) &&
    ragHasAnySupport &&
    finalScore >= MIN_FINAL_SCORE;

  // Cache despues de tener observacion y RAG
  const requestHash = buildRequestHash({
    imageBuffer,
    cultivoName,
    notes,
    observation,
    ragFingerprint,
  });

  const { data: cached } = await supabase
    .from('diagnosis_cache')
    .select('response_data')
    .eq('request_hash', requestHash)
    .single();

  if (cached) {
    console.log(`[Cache] HIT para el hash: ${requestHash.substring(0, 10)}...`);
    try {
      await supabase.rpc('increment_cache_hit', { p_hash: requestHash });
    } catch (err) {
      console.error(err);
    }
    const remainingCredits = await deductCredit(supabase, userId, profile.credits_remaining);
    return {
      ...cached.response_data,
      remainingCredits,
      fromCache: true,
      ragUsage: { ...ragStats, nameSupport: ragNameSupport },
    };
  }
  console.log(`[Cache] MISS para el hash: ${requestHash.substring(0, 10)}...`);

  if (!isConclusive) {
    const reason =
      !ragHasAnySupport
        ? 'rag-no-support'
        : imgScore >= MIN_IMAGE_QUALITY_SCORE && hasVisualSignals
          ? 'low-evidence'
          : null;
    return {
      needsBetterPhoto: true,
      message: buildNeedsBetterPhotoMessage(observation, reason),
    };
  }

  // Etapa 2: diagnostico final
  let geminiResult;
  try {
    geminiResult = await callGeminiDiagnosis({
      base64Image,
      mimeType,
      cultivoName,
      ragContext,
      notes,
      sintomas: observation.sintomas,
      diagnosisTitlePrelim: observation.diagnosisTitlePrelim,
      finalConfidencePercent: Math.round(finalScore * 100),
      cultivoDetectado: observation.cultivoDetectado,
      coincideCultivo: observation.coincideCultivo,
      riesgosVisibles: observation.riesgosVisibles,
      descripcionVisual: observation.descripcionVisual,
      hallazgosVisuales: observation.hallazgosVisuales,
      ragDiagnosisCandidate: ragDiagnosisMatch.candidate,
      ragNameMatchScore: ragDiagnosisMatch.score,
      ragSymptomMatchRatio: ragSymptomSupport.ratio,
      ragMatchedSymptoms: ragSymptomSupport.matched,
    });
  } catch (err) {
    console.error('[DiagnosisEngine] Error en diagnostico (etapa 2):', err);
    return {
      error: `No se pudo generar el diagnostico con el servicio de IA: ${err.message}`,
      statusCode: 500,
    };
  }

  const finalConfidencePercent = Math.round(finalScore * 100);
  let finalMarkdown = buildMarkdownFromReport({
    metadata: geminiResult.metadata,
    report: geminiResult.report,
    observation,
    finalConfidencePercent,
  });
  finalMarkdown = enforceMinimumDetail(finalMarkdown, observation, ragContext, notes);

  const imageUrl = await uploadImage(supabase, imageBuffer, mimeType, userId);
  if (!imageUrl) {
    return { error: 'No se pudo subir la imagen del diagnostico.', statusCode: 500 };
  }

  const diagnosisPayload = {
    user_id: userId,
    image_url: imageUrl,
    cultivo_name: cultivoName,
    ai_diagnosis_md: finalMarkdown,
    confidence_score: finalScore,
    gps_lat: gpsLat ? parseFloat(gpsLat) : null,
    gps_long: gpsLong ? parseFloat(gpsLong) : null,
    status: 'pending',
    source,
    is_confirmed: false,
    confirmation_source: null,
    llm_reasoning: geminiResult.raw_text,
  };

  const { data: insertedDiagnosis, error: insertError } = await supabase
    .from('diagnoses')
    .insert(diagnosisPayload)
    .select()
    .single();

  if (insertError) {
    console.error('Error guardando diagnostico:', insertError);
    return { error: 'No se pudo guardar el diagnostico.', statusCode: 500 };
  }

  const remainingCredits = await deductCredit(supabase, userId, profile.credits_remaining);

  const finalResult = {
    success: true,
    diagnosis: insertedDiagnosis,
    remainingCredits,
    fromCache: false,
    ragUsage: {
      ...ragStats,
      nameSupport: ragNameSupport,
      diagnosisCandidate: ragDiagnosisMatch.candidate,
      nameMatchScore: ragDiagnosisMatch.score,
      symptomSupport: ragSymptomSupport,
    },
    observation,
    scores: {
      final: finalScore,
      vision: visionScore,
      rag: ragSupportScore,
      ragNameRatio: ragNameSupport.ratio,
      ragNameMatchScore: ragDiagnosisMatch.score,
      ragSymptomRatio: ragSymptomSupport.ratio,
      image: imgScore,
    },
  };

  const { error: cacheError } = await supabase.from('diagnosis_cache').insert({
    request_hash: requestHash,
    request_details: {
      cultivoName,
      notes,
      userId,
      source,
      ragFingerprint,
      observation,
    },
    response_data: finalResult,
  });
  if (cacheError) console.error('[Cache] Error guardando en cache:', cacheError);

  return finalResult;
}
