-- Añade los campos para la verificación de diagnóstico en dos pasos.

ALTER TABLE public.diagnoses
ADD COLUMN is_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN confirmation_source TEXT;

-- Opcional: Añadir un comentario para describir las nuevas columnas,
-- mejora la introspección de la base de datos.
COMMENT ON COLUMN public.diagnoses.is_confirmed IS 'Indica si el diagnóstico fue verificado contra una fuente canónica en la base de conocimientos RAG.';
COMMENT ON COLUMN public.diagnoses.confirmation_source IS 'La fuente (ej. nombre de archivo o documento) que se usó para confirmar el diagnóstico.';
