-- Parte 4: Políticas RLS para la tabla diagnosis_rag_sources
ALTER TABLE public.diagnosis_rag_sources ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propios diagnósticos RAG
CREATE POLICY "Users can view their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);

-- Política: Los usuarios solo pueden insertar en sus propios diagnósticos
CREATE POLICY "Users can insert into their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);

-- Política: Los usuarios solo pueden actualizar sus propios diagnósticos RAG
CREATE POLICY "Users can update their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);

-- Política: Los usuarios solo pueden eliminar sus propios diagnósticos RAG
CREATE POLICY "Users can delete their own diagnosis RAG sources" ON public.diagnosis_rag_sources
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.diagnoses d
    WHERE d.id = diagnosis_rag_sources.diagnosis_id
    AND d.user_id = auth.uid()
  )
);