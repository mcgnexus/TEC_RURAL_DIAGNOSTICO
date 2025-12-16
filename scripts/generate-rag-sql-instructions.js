import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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

async function setupRagTraceability() {
  try {
    console.log('🚀 Configurando trazabilidad RAG...\n');

    // Paso 1: Verificar si la tabla existe
    console.log('🔍 Paso 1: Verificando tabla diagnosis_rag_sources...');
    const { data: tableExists, error: tableCheckError } = await supabase
      .from('diagnosis_rag_sources')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.code === 'PGRST116') {
      console.log('📋 La tabla no existe. Creándola...');
      
      // Crear tabla usando SQL directo a través del cliente
      const createTableQuery = `
        CREATE TABLE public.diagnosis_rag_sources (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
          chunk_id UUID REFERENCES public.ingestion_chunks(id) ON DELETE CASCADE NOT NULL,
          similarity_score FLOAT NOT NULL,
          chunk_index INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `;

      try {
        // Intentar ejecutar el SQL directamente
        const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableQuery });
        if (createError) throw createError;
        console.log('✅ Tabla creada exitosamente');
      } catch (execError) {
        console.log('ℹ️ No se puede ejecutar SQL directo, intentando método alternativo...');
        
        // Método alternativo: crear la tabla manualmente con inserts
        // Esto es un workaround ya que no tenemos acceso directo a SQL
        console.log('💡 Por favor, ejecuta manualmente el siguiente SQL en el dashboard de Supabase:');
        console.log('\n' + '='.repeat(60));
        console.log(createTableQuery + ';');
        console.log('='.repeat(60) + '\n');
        
        return {
          success: false,
          message: 'Necesitas ejecutar el SQL manualmente en el dashboard de Supabase',
          manualSteps: [createTableQuery]
        };
      }
    } else {
      console.log('✅ La tabla ya existe');
    }

    // Paso 2: Verificar índices
    console.log('\n🔍 Paso 2: Verificando índices...');
    console.log('💡 Por favor, ejecuta manualmente los siguientes índices en Supabase:');
    
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_diagnosis_id ON public.diagnosis_rag_sources(diagnosis_id);',
      'CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_chunk_id ON public.diagnosis_rag_sources(chunk_id);',
      'CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_similarity ON public.diagnosis_rag_sources(similarity_score DESC);'
    ];

    console.log('\n' + '='.repeat(60));
    indexQueries.forEach(query => console.log(query));
    console.log('='.repeat(60) + '\n');

    // Paso 3: Verificar funciones
    console.log('🔍 Paso 3: Verificando funciones...');
    console.log('💡 Por favor, ejecuta manualmente las siguientes funciones en Supabase:');
    
    const functionQueries = [
      `-- Función para obtener fuentes RAG de un diagnóstico
CREATE OR REPLACE FUNCTION public.get_diagnosis_rag_sources(diagnosis_uuid UUID)
RETURNS TABLE (
  chunk_id UUID,
  similarity_score FLOAT,
  chunk_index INTEGER,
  content TEXT,
  filename TEXT,
  document_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ic.id as chunk_id,
    drs.similarity_score,
    drs.chunk_index,
    ic.content,
    ic.metadata->>'filename' as filename,
    ic.document_id
  FROM public.diagnosis_rag_sources drs
  JOIN public.ingestion_chunks ic ON drs.chunk_id = ic.id
  WHERE drs.diagnosis_id = diagnosis_uuid
  ORDER BY drs.similarity_score DESC;
END;
$$ LANGUAGE plpgsql;`,

      `-- Función para estadísticas de uso RAG por usuario
CREATE OR REPLACE FUNCTION public.get_user_rag_stats(user_uuid UUID)
RETURNS TABLE (
  total_diagnoses BIGINT,
  diagnoses_with_rag BIGINT,
  avg_rag_sources_per_diagnosis FLOAT,
  avg_similarity_score FLOAT,
  top_documents JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT d.id) as total_diagnoses,
    COUNT(DISTINCT CASE WHEN drs.chunk_id IS NOT NULL THEN d.id END) as diagnoses_with_rag,
    COALESCE(AVG(DISTINCT rag_counts.chunk_count), 0) as avg_rag_sources_per_diagnosis,
    COALESCE(AVG(drs.similarity_score), 0) as avg_similarity_score,
    (
      SELECT jsonb_agg(doc_info)
      FROM (
        SELECT jsonb_build_object(
          'document_id', ic.document_id,
          'filename', ic.metadata->>'filename',
          'usage_count', COUNT(*),
          'avg_similarity', AVG(drs.similarity_score)
        ) as doc_info
        FROM public.diagnosis_rag_sources drs2
        JOIN public.ingestion_chunks ic ON drs2.chunk_id = ic.id
        JOIN public.diagnoses d2 ON drs2.diagnosis_id = d2.id
        WHERE d2.user_id = user_uuid
        GROUP BY ic.document_id, ic.metadata->>'filename'
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) top_docs
    ) as top_documents
  FROM public.diagnoses d
  LEFT JOIN public.diagnosis_rag_sources drs ON d.id = drs.diagnosis_id
  LEFT JOIN (
    SELECT diagnosis_id, COUNT(*) as chunk_count
    FROM public.diagnosis_rag_sources
    GROUP BY diagnosis_id
  ) rag_counts ON d.id = rag_counts.diagnosis_id
  WHERE d.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;`
    ];

    console.log('\n' + '='.repeat(60));
    functionQueries.forEach(query => console.log('\n' + query));
    console.log('='.repeat(60) + '\n');

    // Paso 4: Verificar RLS
    console.log('🔍 Paso 4: Configurando RLS...');
    console.log('💡 Por favor, ejecuta manualmente las siguientes políticas en Supabase:');
    
    const rlsQueries = [
      'ALTER TABLE public.diagnosis_rag_sources ENABLE ROW LEVEL SECURITY;',
      
      `-- Política: Los usuarios solo pueden ver sus propios diagnósticos RAG
CREATE POLICY "Users can view their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);`,

      `-- Política: Los usuarios solo pueden insertar en sus propios diagnósticos
CREATE POLICY "Users can insert into their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);`
    ];

    console.log('\n' + '='.repeat(60));
    rlsQueries.forEach(query => console.log('\n' + query));
    console.log('='.repeat(60) + '\n');

    console.log('🎯 Resumen de pasos manuales:');
    console.log('1. Ve al dashboard de Supabase');
    console.log('2. Abre la consola SQL');
    console.log('3. Ejecuta cada bloque de SQL mostrado arriba');
    console.log('4. ¡Listo! El sistema de trazabilidad RAG estará activo');

    return {
      success: true,
      message: 'Instrucciones generadas para configuración manual',
      manualSteps: [
        ...indexQueries,
        ...functionQueries,
        ...rlsQueries
      ]
    };

  } catch (error) {
    console.error('💥 Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar
setupRagTraceability().then(result => {
  if (result.success) {
    console.log('\n🎉 Proceso completado');
    console.log('📋', result.message);
  } else {
    console.error('\n❌ Error:', result.error);
  }
});