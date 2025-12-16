import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mistralApiKey = process.env.MISTRAL_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateEmbedding(text) {
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
  const data = await response.json();
  return data.data[0].embedding;
}

async function saveRagSources(diagnosisId, ragMatches) {
  if (!ragMatches || ragMatches.length === 0) return;

  console.log(`💾 Intentando guardar ${ragMatches.length} fuentes RAG...`);
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
    console.error('❌ Error guardando fuentes RAG:', error);
  } else {
    console.log('✅ Fuentes RAG guardadas exitosamente');
  }
}

async function simulateDiagnosisFlow() {
  const userId = '013f5087-3370-4bef-8587-31f2c75d9b12';
  const query = 'hojas amarillas en tomate';
  
  try {
    console.log('🚀 Iniciando simulación de flujo RAG...');
    
    // 1. Generar embedding
    console.log('🧠 Generando embedding...');
    const embedding = await generateEmbedding(query);
    
    // 2. Buscar coincidencias
    console.log('🔎 Buscando coincidencias...');
    const { data: matches, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.55,
      match_count: 5,
    });
    
    if (error) throw error;
    console.log(`✅ Encontradas ${matches.length} coincidencias`);
    
    if (matches.length === 0) {
      console.log('⚠️ No hay coincidencias, no se puede probar el guardado.');
      return;
    }

    // 3. Crear diagnóstico dummy
    console.log('📝 Creando diagnóstico de prueba...');
    const { data: diagnosis, error: diagError } = await supabase
      .from('diagnoses')
      .insert({
        user_id: userId,
        cultivo_name: 'Tomate Prueba RAG',
        status: 'pending',
        confidence_score: 0.95,
        ai_diagnosis_md: 'Diagnóstico de prueba para verificar RAG.',
        image_url: 'https://placehold.co/600x400',
        source: 'web'
      })
      .select()
      .single();
      
    if (diagError) throw diagError;
    console.log(`✅ Diagnóstico creado: ${diagnosis.id}`);
    
    // 4. Guardar fuentes RAG
    await saveRagSources(diagnosis.id, matches);
    
    // 5. Verificar guardado
    const { count } = await supabase
      .from('diagnosis_rag_sources')
      .select('*', { count: 'exact', head: true })
      .eq('diagnosis_id', diagnosis.id);
      
    console.log(`📊 Verificación: ${count} registros encontrados en diagnosis_rag_sources para este diagnóstico.`);
    
    if (count === matches.length) {
      console.log('🎉 ¡ÉXITO! El sistema guarda correctamente las fuentes RAG.');
    } else {
      console.error('❌ FALLO: No coinciden los registros guardados.');
    }
    
    // Limpieza (opcional)
    // await supabase.from('diagnoses').delete().eq('id', diagnosis.id);
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

simulateDiagnosisFlow();