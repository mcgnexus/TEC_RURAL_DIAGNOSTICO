-- ================================================================
-- WHATSAPP SESSIONS - Gestión de sesiones conversacionales
-- ================================================================

-- Tabla para guardar el estado de conversaciones de WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL, -- Número de teléfono normalizado (ej: +573001234567)
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Estado de la conversación
  state TEXT NOT NULL DEFAULT 'idle', -- idle, awaiting_cultivo, awaiting_notes, awaiting_image, processing

  -- Datos recolectados en la sesión
  cultivo_name TEXT,
  notes TEXT,
  image_url TEXT, -- URL temporal de la imagen de WhatsApp

  -- Metadatos
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes') NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Índice único para evitar sesiones duplicadas por teléfono
  CONSTRAINT whatsapp_sessions_phone_key UNIQUE(phone)
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON public.whatsapp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_state ON public.whatsapp_sessions(state);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_expires_at ON public.whatsapp_sessions(expires_at);

-- Crear función para actualizar updated_at si no existe
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS whatsapp_sessions_updated_at ON public.whatsapp_sessions;
CREATE TRIGGER whatsapp_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Función para limpiar sesiones expiradas automáticamente
CREATE OR REPLACE FUNCTION public.cleanup_expired_whatsapp_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.whatsapp_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS: Solo admins pueden ver sesiones
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Admins pueden gestionar todas las sesiones
DROP POLICY IF EXISTS "Admins manage all whatsapp sessions" ON public.whatsapp_sessions;
CREATE POLICY "Admins manage all whatsapp sessions" ON public.whatsapp_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Asegurar que la tabla diagnoses tiene el campo notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'diagnoses'
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.diagnoses ADD COLUMN notes TEXT;
    COMMENT ON COLUMN public.diagnoses.notes IS 'Notas o síntomas adicionales proporcionados por el usuario';
  END IF;
END $$;

-- Comentarios para documentación
COMMENT ON TABLE public.whatsapp_sessions IS 'Gestiona el estado de conversaciones de WhatsApp para el chatbot';
COMMENT ON COLUMN public.whatsapp_sessions.state IS 'Estado actual de la conversación: idle, awaiting_cultivo, awaiting_notes, awaiting_image, processing';
COMMENT ON COLUMN public.whatsapp_sessions.expires_at IS 'Fecha de expiración de la sesión (default: 30 minutos desde última actualización)';
