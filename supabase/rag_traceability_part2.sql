-- Parte 2: Función para obtener fuentes RAG de un diagnóstico
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