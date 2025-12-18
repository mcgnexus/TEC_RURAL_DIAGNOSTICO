-- ================================================================
-- SCRIPT PARA APLICAR TODAS LAS MIGRACIONES DE TELEGRAM
-- ================================================================
-- Ejecutar este script en Supabase SQL Editor:
-- 1. Ve a https://supabase.com/dashboard
-- 2. Selecciona tu proyecto
-- 3. Ve a SQL Editor
-- 4. Copia y pega todo este contenido
-- 5. Ejecuta
-- ================================================================

-- ================================================================
-- 1. AGREGAR SOPORTE PARA TELEGRAM EN PROFILES
-- ================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telegram_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);

COMMENT ON COLUMN profiles.telegram_id IS 'ID único de usuario de Telegram (chat_id)';
COMMENT ON COLUMN profiles.telegram_username IS 'Username de Telegram (sin @)';

-- ================================================================
-- 2. TABLA DE SESIONES DE TELEGRAM
-- ================================================================

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

CREATE INDEX IF NOT EXISTS telegram_sessions_telegram_id_idx
  ON public.telegram_sessions(telegram_id);

CREATE INDEX IF NOT EXISTS telegram_sessions_user_id_idx
  ON public.telegram_sessions(user_id);

CREATE INDEX IF NOT EXISTS telegram_sessions_expires_at_idx
  ON public.telegram_sessions(expires_at);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to telegram_sessions"
  ON public.telegram_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

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

COMMENT ON TABLE telegram_sessions IS 'Gestiona sesiones conversacionales del bot de Telegram';
COMMENT ON COLUMN telegram_sessions.state IS 'Estado actual: idle, awaiting_cultivo, awaiting_notes, awaiting_image, processing';
COMMENT ON COLUMN telegram_sessions.expires_at IS 'Las sesiones expiran después de 30 minutos de inactividad';

-- ================================================================
-- 3. TABLA DE TOKENS DE VINCULACIÓN TELEGRAM
-- ================================================================

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '15 minutes',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_token_idx
  ON public.telegram_link_tokens(token);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_telegram_id_idx
  ON public.telegram_link_tokens(telegram_id);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_expires_at_idx
  ON public.telegram_link_tokens(expires_at);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to telegram_link_tokens"
  ON public.telegram_link_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cleanup_expired_telegram_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.telegram_link_tokens
  WHERE expires_at < NOW() OR used = TRUE;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE telegram_link_tokens IS 'Tokens temporales para vincular cuentas web con Telegram';
COMMENT ON COLUMN telegram_link_tokens.token IS 'Token único generado para vinculación (6 caracteres alfanuméricos)';
COMMENT ON COLUMN telegram_link_tokens.expires_at IS 'Los tokens expiran después de 15 minutos';

-- ================================================================
-- 4. EXTENDER DEDUPLICACIÓN DE MENSAJES PARA TELEGRAM
-- ================================================================

ALTER TABLE processed_webhook_messages
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS telegram_id TEXT;

CREATE INDEX IF NOT EXISTS processed_webhook_messages_source_idx
  ON public.processed_webhook_messages(source);

CREATE INDEX IF NOT EXISTS processed_webhook_messages_telegram_idx
  ON public.processed_webhook_messages(telegram_id, source);

COMMENT ON COLUMN processed_webhook_messages.source IS 'Origen del mensaje: whatsapp o telegram';
COMMENT ON COLUMN processed_webhook_messages.telegram_id IS 'ID de usuario de Telegram (si aplica)';

-- ================================================================
-- 5. AGREGAR COLUMNA PARA NOTIFICACIONES DE TELEGRAM
-- ================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notify_telegram_on_diagnosis BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN profiles.notify_telegram_on_diagnosis IS 'Enviar notificaciones automáticas a Telegram cuando se completa un diagnóstico';

-- ================================================================
-- MIGRACIONES COMPLETADAS EXITOSAMENTE
-- ================================================================
