-- Parte 3: Función para estadísticas de uso RAG por usuario
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