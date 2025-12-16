import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Falta configurar NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

async function executeSQL() {
  try {
    console.log('🚀 Ejecutando script de trazabilidad RAG...');
    
    // Leer el archivo SQL
    const sqlContent = readFileSync('./supabase/rag_traceability.sql', 'utf8');
    
    // Dividir en sentencias individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Encontradas ${statements.length} sentencias SQL`);

    // Ejecutar cada sentencia
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`🔧 Ejecutando sentencia ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });
        
        if (error) {
          console.error(`❌ Error en sentencia ${i + 1}:`, error.message);
          console.error('SQL:', statement.substring(0, 200) + '...');
          throw error;
        }
        
        console.log(`✅ Sentencia ${i + 1} ejecutada correctamente`);
      } catch (stmtError) {
        console.error(`❌ Error ejecutando sentencia ${i + 1}:`, stmtError.message);
        throw stmtError;
      }
    }

    console.log('🎉 ¡Script ejecutado exitosamente!');
    console.log('\n📊 Resumen de cambios:');
    console.log('- ✅ Tabla diagnosis_rag_sources creada');
    console.log('- ✅ Vista diagnoses_with_rag_sources creada');
    console.log('- ✅ Funciones get_diagnosis_rag_sources y get_user_rag_stats creadas');
    console.log('- ✅ Políticas RLS configuradas');
    
  } catch (error) {
    console.error('💥 Error general:', error.message);
    process.exit(1);
  }
}

// Ejecutar
executeSQL();