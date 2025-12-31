const GEMINI_OBSERVATION_PROMPT = `
ROL: Eres un fitopatologo. Solo debes describir lo que ves en la imagen y evaluar si sirve.
TAREA: Detecta cultivo, calidad de imagen, sintomas visibles, descripcion visual detallada y un diagnostico preliminar solo por vision.

INSTRUCCIONES:
- Si la imagen es inutilizable, marca nitidez="baja" y devuelve sintomas=[].
- Usa el cultivo declarado como pista, pero no lo asumas si no coincide visualmente.
- Siempre devuelve un diagnostico preliminar por vision. Si no estas seguro, usa "posible <diagnostico>".
- No uses comentarios ni comas finales en el JSON.
- Limita "sintomas" y "hallazgos_visuales" a maximo 4 elementos cada uno.
- "descripcion_visual" debe ser una sola linea, maximo 300 caracteres.
- Incluye hasta 3 sinonimos comunes en "diagnosis_aliases" (si aplica).
- Responde UNICAMENTE JSON valido, sin Markdown ni texto extra.

FORMATO JSON ESPERADO:
{
  "cultivo_detectado": "texto o \"desconocido\"",
  "cultivo_confianza": 0-100,
  "coincide_cultivo": true | false,
  "sintomas": ["manchas irregulares", "necrosis en bordes", ...],
  "hallazgos_visuales": ["texto breve de lo observado", "..."],
  "descripcion_visual": "parrafo breve describiendo lo que se ve",
  "calidad_imagen": { "nitidez": "alta|media|baja", "cobertura": "alta|media|baja", "notas": "texto breve" },
  "riesgos_visibles": ["plaga visible", "mancha fungica", "carencia probable"],
  "diagnosis_title_prelim": "texto corto o \"posible <diagnostico>\"",
  "diagnosis_aliases": ["sinonimo 1", "sinonimo 2"],
  "vision_confidence": 0-100
}

SI NO HAY SOPORTE VISUAL: sintomas vacio, coincide_cultivo=false, nitidez="baja".
`;

export const buildGeminiObservationPrompt = ({ cultivoName, notes }) => {
  const safeCultivo = cultivoName?.trim() || 'cultivo sin especificar';
  const safeNotes = notes?.trim() || 'sin notas adicionales';

  return `${GEMINI_OBSERVATION_PROMPT}

DATOS:
- Cultivo declarado: "${safeCultivo}"
- Notas del agricultor: ${safeNotes}
`;
};

const GEMINI_DIAGNOSIS_PROMPT = `
ROL: Fitopatologo senior. Genera un informe estructurado usando el diagnostico preliminar por vision y el RAG del mismo nombre.

PASOS:
1) Usa el diagnostico preliminar como base, no inventes un diagnostico distinto.
2) Contrasta con el RAG del mismo nombre; si no hay soporte, marca is_conclusive=false.
3) Si hay sintomas que contradicen el contexto, mencionalos en "supporting_points".
4) Describe la imagen de forma especifica antes de las recomendaciones.

SALIDA: Responde SOLO con JSON valido (sin Markdown ni texto extra).
JSON ESPERADO:
{
  "confidence_score": 0-100,
  "is_conclusive": true | false,
  "diagnosis_title": "texto corto",
  "urgency_level": "Baja" | "Media" | "Alta" | "Muy Alta",
  "supporting_points": ["sintoma X respaldado por evidencia Y", ...],
  "report": {
    "descripcion_visual": "texto detallado",
    "por_que": "explicacion basada en sintomas y RAG",
    "acciones_ecologicas": ["paso 1", "paso 2"],
    "acciones_quimicas": ["principio activo", "nota de seguridad"],
    "recomendaciones": ["consejo final", "advertencia"],
    "referencias_rag": ["fragmento o titulo usado del RAG"]
  }
}

REGLAS:
- No incluyas texto fuera del JSON.
- Escribe todo en espanol y sin razonamiento interno.
- El contenido del objeto "report" debe ser lo suficientemente detallado para generar un informe largo.
`;

export const buildGeminiDiagnosisPrompt = ({
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
  const safeCultivo = cultivoName?.trim() || 'cultivo sin especificar';
  const safeNotes = notes?.trim() || 'sin notas adicionales';
  const safeSintomas = Array.isArray(sintomas) && sintomas.length > 0 ? sintomas : ['sin sintomas claros'];
  const safeCultivoDetectado = cultivoDetectado?.trim() || 'desconocido';
  const safeRiesgos = Array.isArray(riesgosVisibles) && riesgosVisibles.length > 0
    ? riesgosVisibles.join('; ')
    : 'ninguno';
  const safeDiagnosis = diagnosisTitlePrelim?.trim() || 'desconocido';
  const safeConfidence = Number.isFinite(finalConfidencePercent)
    ? Math.max(0, Math.min(100, Math.round(finalConfidencePercent)))
    : 0;
  const safeDescripcion = descripcionVisual?.trim() || 'sin descripcion visual detallada';
  const safeHallazgos = Array.isArray(hallazgosVisuales) && hallazgosVisuales.length > 0
    ? hallazgosVisuales.join('; ')
    : 'sin hallazgos visuales destacados';
  const safeRagDiagnosis = ragDiagnosisCandidate?.trim() || 'no identificado';
  const safeNameScore = Number.isFinite(ragNameMatchScore)
    ? Math.round(ragNameMatchScore * 100)
    : 0;
  const safeSymptomRatio = Number.isFinite(ragSymptomMatchRatio)
    ? Math.round(ragSymptomMatchRatio * 100)
    : 0;
  const safeMatchedSymptoms = Array.isArray(ragMatchedSymptoms) && ragMatchedSymptoms.length > 0
    ? ragMatchedSymptoms.join('; ')
    : 'sin coincidencias claras';

  return `${GEMINI_DIAGNOSIS_PROMPT}

DATOS DEL CASO:
- Cultivo declarado: "${safeCultivo}"
- Cultivo detectado (etapa 1): "${safeCultivoDetectado}" (coincide: ${coincideCultivo === false ? 'no' : 'si/indefinido'})
- Sintomas detectados (etapa 1): ${safeSintomas.join('; ')}
- Riesgos visibles: ${safeRiesgos}
- Diagnostico preliminar (vision): "${safeDiagnosis}"
- CONFIDENCE_PERCENT: ${safeConfidence}
- Descripcion visual (etapa 1): ${safeDescripcion}
- Hallazgos visuales (etapa 1): ${safeHallazgos}
- Diagnostico RAG candidato: "${safeRagDiagnosis}"
- Coincidencia nombre (vision vs RAG): ${safeNameScore}%
- Coincidencia sintomas (vision vs RAG): ${safeSymptomRatio}%
- Sintomas coincidentes: ${safeMatchedSymptoms}
- Notas del agricultor: ${safeNotes}

CONTEXTO RAG (resumen):
${ragContext || 'Sin contexto tecnico disponible.'}
`;
};
