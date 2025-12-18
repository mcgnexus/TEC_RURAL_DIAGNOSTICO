/**
 * Servicio de generación de embeddings con Mistral AI
 * Los embeddings son representaciones vectoriales del texto
 * que permiten realizar búsquedas semánticas.
 */
import { redactForLog, redactString } from '@/lib/logging';

/**
 * Generar embedding para un texto usando Mistral AI
 * @param {string} text - Texto a vectorizar
 * @returns {Promise<Array<number>>} - Vector de embedding
 */
export async function generateEmbedding(text) {
  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!mistralApiKey) {
    throw new Error('MISTRAL_API_KEY no está configurada en las variables de entorno');
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: [text],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Error de Mistral API: ${response.status} - ${errorData.message || response.statusText}`
      );
    }

    const data = await response.json();

    if (!data?.data?.[0]?.embedding) {
      throw new Error('Respuesta inválida de Mistral API');
    }

    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', redactForLog(error));
    throw new Error('Error al generar embedding: ' + redactString(error?.message || ''));
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generar embeddings para múltiples textos en batch (modo conservador)
 * @param {Array<string>} texts - Array de textos a vectorizar
 * @param {number} batchSize - Tamaño del lote (default: 10)
 * @returns {Promise<Array<Array<number>>>} - Array de vectores
 */
export async function generateEmbeddingsBatch(texts, batchSize = 10) {
  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!mistralApiKey) {
    throw new Error('MISTRAL_API_KEY no está configurada en las variables de entorno');
  }

  const delayBetweenBatchesMs = Number(process.env.MISTRAL_EMBED_DELAY_MS ?? 750);
  const maxRetries = Number(process.env.MISTRAL_EMBED_MAX_RETRIES ?? 5);
  const baseBackoffMs = Number(process.env.MISTRAL_EMBED_BACKOFF_MS ?? 800);

  const embeddings = [];

  if (!Array.isArray(texts) || texts.length === 0) {
    return embeddings;
  }

  console.log(`🚀 Iniciando generación de embeddings en lotes de ${batchSize}...`);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNumber = i / batchSize + 1;

    console.log(`📦 Procesando lote ${batchNumber} (${batch.length} textos)`);

    try {
      let response = null;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        
        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mistralApiKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-embed',
            input: batch,
          }),
        };

        console.log(`  🤙 Intento ${attempt + 1}/${maxRetries + 1} para lote ${batchNumber}. Endpoint: https://api.mistral.ai/v1/embeddings`);
        
        response = await fetch('https://api.mistral.ai/v1/embeddings', fetchOptions);

        if (response.ok) {
          console.log(`  ✅ Respuesta OK (${response.status}) para lote ${batchNumber}`);
          break;
        }

        console.warn(`  ⚠️ Respuesta no OK (${response.status}) para lote ${batchNumber}`);
        
        const retryable = response.status === 429 || response.status === 503;
        if (!retryable || attempt === maxRetries) {
          const errorBody = await response.text().catch(() => 'No se pudo leer el cuerpo del error');
          console.error(
            `  ❌ Error final de API para lote ${batchNumber}: ${response.status} - ${response.statusText}. Cuerpo:`,
            redactString(errorBody)
          );
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Error de Mistral API: ${response.status} - ${errorData.message || response.statusText}`
          );
        }

        const jitter = Math.floor(Math.random() * 250);
        const backoffMs = baseBackoffMs * Math.pow(2, attempt) + jitter;
        console.log(`  ⏳ Reintentando en ${backoffMs}ms...`);
        await sleep(backoffMs);
      }

      const responseBody = await response.text();
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        console.error('  ❌ Error parseando JSON de la respuesta. Cuerpo:', redactString(responseBody));
        throw new Error('No se pudo parsear la respuesta JSON de Mistral API');
      }
      

      if (!data?.data || data.data.length !== batch.length) {
        console.error('  ❌ Respuesta inválida de Mistral API para batch. Data:', redactForLog(data));
        throw new Error('Respuesta inválida de Mistral API para batch');
      }

      console.log(`  👍 Embeddings recibidos para lote ${batchNumber}`);
      embeddings.push(...data.data.map(item => item.embedding));

      if (i + batchSize < texts.length) {
        console.log(`  ⏸️ Pausa de ${delayBetweenBatchesMs}ms entre lotes`);
        await sleep(delayBetweenBatchesMs);
      }
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i / batchSize + 1}:`, redactForLog(error));
      throw new Error(`Error al generar embeddings (batch ${i / batchSize + 1}): ${redactString(error?.message || '')}`);
    }
  }

  console.log('✅ Proceso de embeddings finalizado.');
  return embeddings;
}

/**
 * Calcular similitud coseno entre dos vectores
 * @param {Array<number>} vecA - Primer vector
 * @param {Array<number>} vecB - Segundo vector
 * @returns {number} - Similitud coseno (0-1)
 */
export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Los vectores deben tener la misma longitud');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Validar que un vector de embedding tenga el formato correcto
 * @param {Array<number>} embedding - Vector a validar
 * @returns {boolean} - true si es válido
 */
export function isValidEmbedding(embedding) {
  if (!Array.isArray(embedding)) {
    return false;
  }

  if (embedding.length === 0) {
    return false;
  }

  return embedding.every(val => typeof val === 'number' && !Number.isNaN(val));
}

/**
 * Obtener la dimensionalidad esperada del modelo
 * @returns {number} - Dimensión del vector de embedding
 */
export function getEmbeddingDimension() {
  return 1024;
}
