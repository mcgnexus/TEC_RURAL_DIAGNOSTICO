import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Intentar cargar .env.local explícitamente
config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mistralApiKey = process.env.MISTRAL_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !mistralApiKey) {
  console.error('❌ Faltan variables de entorno (SUPABASE_URL, SERVICE_KEY o MISTRAL_API_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateEmbedding(text) {
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
      throw new Error(`Mistral API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

async function testRagSearch() {
  try {
    console.log('🔍 Probando búsqueda RAG (con Mistral Embeddings)...');
    
    // Consulta genérica de agricultura
    const testQuery = 'plagas y enfermedades en cultivos';
    console.log(`📝 Query: "${testQuery}"`);
    
    // Generar embedding
    console.log('🧠 Generando embedding...');
    const embedding = await generateEmbedding(testQuery);
    
    // Buscar coincidencias
    console.log('🔎 Buscando coincidencias...');
    const { data: matches, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.50,
      match_count: 5,
    });
    
    if (error) {
      console.error('❌ Error en match_knowledge:', error);
      return;
    }
    
    console.log(`✅ Encontradas ${matches?.length || 0} coincidencias`);
    
    if (matches && matches.length > 0) {
      matches.forEach((match, i) => {
        console.log(`\n📄 Coincidencia #${i + 1} (${(match.similarity * 100).toFixed(1)}%)`);
        console.log(`   ID: ${match.id}`);
        console.log(`   Contenido: ${match.content.substring(0, 100)}...`);
      });
    } else {
      console.log('⚠️ No se encontraron coincidencias.');
      
      // Verificar si hay chunks
      const { count } = await supabase.from('ingestion_chunks').select('*', { count: 'exact', head: true });
      console.log(`📊 Total de chunks en DB: ${count}`);
    }
    
  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

testRagSearch();