import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  console.log('🔍 Listando tablas...');
  
  // Consulta SQL para listar tablas públicas
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'" 
  });
  
  // Si exec_sql falla (probablemente), intentar inferir
  if (error) {
    console.log('❌ No se puede listar tablas con exec_sql.');
    console.log('Intentando verificar tablas comunes...');
    
    const tables = ['ingestion_chunks', 'document_sections', 'embeddings', 'documents', 'chunks'];
    
    for (const table of tables) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!error) {
        console.log(`✅ Tabla encontrada: ${table} (${count} filas)`);
        
        // Verificar si el chunk perdido está aquí
        const chunkId = '3c4aaaed-9bc7-4f0a-9b9c-a946f89f2a9f';
        const { data } = await supabase.from(table).select('id').eq('id', chunkId).single();
        if (data) {
          console.log(`🎉 ¡El chunk perdido está en la tabla ${table}!`);
        }
      } else {
        console.log(`❌ Tabla no accesible/inexistente: ${table}`);
      }
    }
  } else {
    console.log('Tablas:', data);
  }
}

listTables();