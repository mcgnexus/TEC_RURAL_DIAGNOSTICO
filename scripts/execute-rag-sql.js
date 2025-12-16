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

// Función para ejecutar SQL usando RPC personalizado
async function executeSQLPart(partNumber, sqlContent) {
  console.log(`\n🚀 Ejecutando Parte ${partNumber}...`);
  
  try {
    // Dividir en sentencias individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Encontradas ${statements.length} sentencias`);

    // Ejecutar cada sentencia
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`🔧 Ejecutando sentencia ${i + 1}/${statements.length}...`);
      
      try {
        // Usar el método raw SQL de Supabase
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });
        
        if (error) {
          console.error(`❌ Error en sentencia ${i + 1}:`, error.message);
          console.error('SQL:', statement.substring(0, 100) + '...');
          throw error;
        }
        
        console.log(`✅ Sentencia ${i + 1} ejecutada correctamente`);
      } catch (stmtError) {
        console.error(`❌ Error ejecutando sentencia ${i + 1}:`, stmtError.message);
        throw stmtError;
      }
    }

    console.log(`✅ Parte ${partNumber} completada`);
    return true;
    
  } catch (error) {
    console.error(`💥 Error en Parte ${partNumber}:`, error.message);
    return false;
  }
}

// Método alternativo: ejecutar SQL directamente
async function executeSQLDirect(partNumber, sqlContent) {
  console.log(`\n🚀 Ejecutando Parte ${partNumber} (método directo)...`);
  
  try {
    // Intentar ejecutar usando el método sql directo
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: sqlContent 
    });
    
    if (error) {
      console.error(`❌ Error en Parte ${partNumber}:`, error.message);
      return false;
    }
    
    console.log(`✅ Parte ${partNumber} ejecutada correctamente`);
    return true;
    
  } catch (error) {
    console.error(`💥 Error en Parte ${partNumber}:`, error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🎯 Iniciando ejecución de trazabilidad RAG...');
    
    // Leer y ejecutar cada parte
    const parts = [
      { file: './supabase/rag_traceability_part1.sql', number: 1 },
      { file: './supabase/rag_traceability_part2.sql', number: 2 },
      { file: './supabase/rag_traceability_part3.sql', number: 3 },
      { file: './supabase/rag_traceability_part4.sql', number: 4 }
    ];
    
    for (const part of parts) {
      try {
        const sqlContent = readFileSync(part.file, 'utf8');
        
        // Primero intentar método directo
        let success = await executeSQLDirect(part.number, sqlContent);
        
        // Si falla, intentar método por sentencias
        if (!success) {
          console.log(`🔄 Intentando método por sentencias para Parte ${part.number}...`);
          success = await executeSQLPart(part.number, sqlContent);
        }
        
        if (!success) {
          console.error(`❌ Parte ${part.number} falló`);
          break;
        }
        
      } catch (fileError) {
        console.error(`❌ Error leyendo archivo ${part.file}:`, fileError.message);
        break;
      }
    }
    
    console.log('\n🎉 Proceso completado');
    
  } catch (error) {
    console.error('💥 Error general:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main();