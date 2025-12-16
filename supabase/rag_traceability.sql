-- ================================================================
-- TRAZABILIDAD RAG - Sistema de seguimiento de fuentes
-- ================================================================

-- Tabla para guardar la relación entre diagnósticos y chunks RAG utilizados
CREATE TABLE IF NOT EXISTS public.diagnosis_rag_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
  chunk_id UUID REFERENCES public.ingestion_chunks(id) ON DELETE CASCADE NOT NULL,
  similarity_score FLOAT NOT NULL, -- Score de similitud del embedding
  chunk_index INTEGER NOT NULL, -- Orden de relevancia (1 = más relevante)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_diagnosis_id ON public.diagnosis_rag_sources(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_chunk_id ON public.diagnosis_rag_sources(chunk_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_similarity ON public.diagnosis_rag_sources(similarity_score DESC);

-- Vista para obtener diagnósticos con sus fuentes RAG
CREATE OR REPLACE VIEW public.diagnoses_with_rag_sources AS
SELECT 
  d.id as diagnosis_id,
  d.user_id,
  d.cultivo_name,
  d.ai_diagnosis_md,
  d.confidence_score,
  d.created_at,
  COUNT(DISTINCT drs.chunk_id) as rag_sources_count,
  AVG(drs.similarity_score) as avg_similarity_score,
  MAX(drs.similarity_score) as max_similarity_score,
  ARRAY_AGG(
    jsonb_build_object(
      'chunk_id', drs.chunk_id,
      'similarity_score', drs.similarity_score,
      'chunk_index', drs.chunk_index,
      'content', ic.content,
      'filename', ic.metadata->>'filename'
    ) ORDER BY drs.similarity_score DESC
  ) as rag_sources
FROM public.diagnoses d
LEFT JOIN public.diagnosis_rag_sources drs ON d.id = drs.diagnosis_id
LEFT JOIN public.ingestion_chunks ic ON drs.chunk_id = ic.id
GROUP BY d.id, d.user_id, d.cultivo_name, d.ai_diagnosis_md, d.confidence_score, d.created_at;

-- Función para obtener fuentes RAG de un diagnóstico específico
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
$$ LANGUAGE plpgsql;

-- Función para estadísticas de uso RAG por usuario
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
$$ LANGUAGE plpgsql;

-- Políticas de seguridad RLS
ALTER TABLE public.diagnosis_rag_sources ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver sus propias fuentes RAG
CREATE POLICY "Users view own RAG sources" ON public.diagnosis_rag_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.diagnoses 
      WHERE id = diagnosis_id 
      AND user_id = auth.uid()
    )
  );

-- Política: admins pueden ver todas las fuentes RAG
CREATE POLICY "Admins view all RAG sources" ON public.diagnosis_rag_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );