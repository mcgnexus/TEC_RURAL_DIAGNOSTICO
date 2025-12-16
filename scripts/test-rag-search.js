import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !geminiKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genAI = new GoogleGenerativeAI(geminiKey);

async function generateEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: 'embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function testRagSearch() {
  try {
    console.log('🔍 Probando búsqueda RAG...');
    
    // Texto de prueba relacionado con agricultura (para encontrar algo)
    const testQuery = 'Enfermedades del tomate hojas amarillas';
    console.log(`📝 Query: "${testQuery}"`);
    
    // Generar embedding
    console.log('🧠 Generando embedding...');
    const embedding = await generateEmbedding(testQuery);
    
    // Buscar coincidencias
    console.log('🔎 Buscando coincidencias...');
    const { data: matches, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.50, // Umbral un poco más bajo para prueba
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
      console.log('⚠️ No se encontraron coincidencias. Verifica que haya documentos indexados.');
      
      // Verificar si hay chunks en la tabla ingestion_chunks
      const { count, error: countError } = await supabase
        .from('ingestion_chunks')
        .select('*', { count: 'exact', head: true });
        
      if (countError) {
        console.error('❌ Error contando chunks:', countError);
      } else {
        console.log(`📊 Total de chunks en la base de datos: ${count}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

testRagSearch();