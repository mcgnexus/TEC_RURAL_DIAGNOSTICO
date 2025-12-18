-- ================================================================
-- TABLA DE SESIONES DE TELEGRAM
-- ================================================================
-- Gestiona el flujo conversacional del bot de Telegram
-- Estados: idle → awaiting_cultivo → awaiting_notes → awaiting_image → processing

CREATE TABLE IF NOT EXISTS public.telegram_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'idle',
  cultivo_name TEXT,
  user_notes TEXT,
  registration_state TEXT,
  registration_data JSONB,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS telegram_sessions_telegram_id_idx
  ON public.telegram_sessions(telegram_id);

CREATE INDEX IF NOT EXISTS telegram_sessions_user_id_idx
  ON public.telegram_sessions(user_id);

CREATE INDEX IF NOT EXISTS telegram_sessions_expires_at_idx
  ON public.telegram_sessions(expires_at);

-- Política de seguridad RLS
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to telegram_sessions"
  ON public.telegram_sessions;

CREATE POLICY "Allow service role full access to telegram_sessions"
  ON public.telegram_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Función para limpiar sesiones expiradas (usada por cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_telegram_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.telegram_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE telegram_sessions IS 'Gestiona sesiones conversacionales del bot de Telegram';
COMMENT ON COLUMN telegram_sessions.state IS 'Estado actual: idle, awaiting_cultivo, awaiting_notes, awaiting_image, processing';
COMMENT ON COLUMN telegram_sessions.expires_at IS 'Las sesiones expiran después de 30 minutos de inactividad';
