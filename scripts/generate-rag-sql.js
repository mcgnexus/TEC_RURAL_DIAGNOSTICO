// Script para generar instrucciones SQL de trazabilidad RAG
console.log('🎯 Generando instrucciones SQL para trazabilidad RAG...\n');

console.log('📋 PASO 1: Crear tabla de trazabilidad RAG');
console.log('='.repeat(60));
console.log(`
CREATE TABLE IF NOT EXISTS public.diagnosis_rag_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
  chunk_id UUID NOT NULL, -- No FK restriction to support hybrid V1/V2 knowledge bases
  similarity_score FLOAT NOT NULL,
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`);
console.log('='.repeat(60));

console.log('\n📋 PASO 2: Crear índices para búsquedas eficientes');
console.log('='.repeat(60));
console.log(`
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_diagnosis_id ON public.diagnosis_rag_sources(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_chunk_id ON public.diagnosis_rag_sources(chunk_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_similarity ON public.diagnosis_rag_sources(similarity_score DESC);
`);
console.log('='.repeat(60));

console.log('\n📋 PASO 3: Crear función para obtener fuentes RAG de un diagnóstico');
console.log('='.repeat(60));
console.log(`
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
    drs.chunk_id,
    drs.similarity_score,
    drs.chunk_index,
    COALESCE(ic.content, kb.content) as content,
    COALESCE(ic.metadata->>'filename', kb.file_name) as filename,
    ic.document_id
  FROM public.diagnosis_rag_sources drs
  LEFT JOIN public.ingestion_chunks ic ON drs.chunk_id = ic.id
  LEFT JOIN public.knowledge_base kb ON drs.chunk_id = kb.id
  WHERE drs.diagnosis_id = diagnosis_uuid
  ORDER BY drs.similarity_score DESC;
END;
$$ LANGUAGE plpgsql;
`);
console.log('='.repeat(60));

console.log('\n📋 PASO 4: Crear función para estadísticas de uso RAG por usuario');
console.log('='.repeat(60));
console.log(`
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
          'document_id', COALESCE(ic.document_id, kb.id),
          'filename', COALESCE(ic.metadata->>'filename', kb.file_name),
          'usage_count', COUNT(*),
          'avg_similarity', AVG(drs2.similarity_score)
        ) as doc_info
        FROM public.diagnosis_rag_sources drs2
        LEFT JOIN public.ingestion_chunks ic ON drs2.chunk_id = ic.id
        LEFT JOIN public.knowledge_base kb ON drs2.chunk_id = kb.id
        JOIN public.diagnoses d2 ON drs2.diagnosis_id = d2.id
        WHERE d2.user_id = user_uuid
        GROUP BY COALESCE(ic.document_id, kb.id), COALESCE(ic.metadata->>'filename', kb.file_name)
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
$$ LANGUAGE plpgsql;
`);
console.log('='.repeat(60));

console.log('\n📋 PASO 5: Configurar políticas RLS');
console.log('='.repeat(60));
console.log(`
ALTER TABLE public.diagnosis_rag_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own diagnosis RAG sources" ON public.diagnosis_rag_sources;
DROP POLICY IF EXISTS "Users can insert into their own diagnosis RAG sources" ON public.diagnosis_rag_sources;

CREATE POLICY "Users can view their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert into their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);
`);
console.log('='.repeat(60));

console.log('\n🎯 INSTRUCCIONES FINALES:');
console.log('='.repeat(60));
console.log(`
1. Abre tu dashboard de Supabase
2. Ve a la sección "SQL Editor"
3. Copia y ejecuta cada bloque de SQL mostrado arriba
4. Asegúrate de ejecutarlos en orden (PASO 1 → PASO 5)
5. Verifica que no haya errores en la ejecución

¡Con esto tu sistema de trazabilidad RAG estará completamente configurado!
`);
console.log('='.repeat(60));

console.log('\n✅ Script generado exitosamente');
console.log('📁 Los comandos SQL también están disponibles en:');
console.log('   - supabase/rag_traceability_part1.sql (Tabla e índices)');
console.log('   - supabase/rag_traceability_part2.sql (Funciones)');
console.log('   - supabase/rag_traceability_part3.sql (Estadísticas)');
console.log('   - supabase/rag_traceability_part4.sql (Políticas RLS)');
