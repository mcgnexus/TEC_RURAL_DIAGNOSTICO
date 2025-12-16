-- Parte 1: Crear tabla de trazabilidad RAG
CREATE TABLE IF NOT EXISTS public.diagnosis_rag_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
  chunk_id UUID REFERENCES public.ingestion_chunks(id) ON DELETE CASCADE NOT NULL,
  similarity_score FLOAT NOT NULL,
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_diagnosis_id ON public.diagnosis_rag_sources(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_chunk_id ON public.diagnosis_rag_sources(chunk_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_similarity ON public.diagnosis_rag_sources(similarity_score DESC);