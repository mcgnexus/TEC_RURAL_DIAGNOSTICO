-- ================================================================
-- AGREGAR CAMPO DE CADENA DE RAZONAMIENTO DEL LLM
-- ================================================================
-- Este campo almacenará la respuesta completa del LLM, incluyendo
-- la cadena de razonamiento utilizada para llegar al diagnóstico.
-- Solo visible para administradores para verificación y auditoría.

-- Agregar campo llm_reasoning a diagnoses
ALTER TABLE public.diagnoses
ADD COLUMN IF NOT EXISTS llm_reasoning TEXT;

-- Comentario para documentar el campo
COMMENT ON COLUMN public.diagnoses.llm_reasoning IS
'Cadena de razonamiento completa del LLM. Solo accesible por administradores para auditoría y verificación del diagnóstico.';

-- El acceso a este campo ya está protegido por las políticas RLS existentes
-- que verifican si el usuario es admin mediante la función is_admin()
