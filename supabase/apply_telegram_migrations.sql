-- ================================================================
-- TELEGRAM MIGRATIONS (IDEMPOTENT)
-- ================================================================
-- Ejecuta este archivo completo en Supabase -> SQL Editor.
--
-- Nota importante:
-- - NO uses "..." (puntos suspensivos) en SQL.
-- - NO existe sintaxis tipo "tabla1/tabla2". Cada sentencia va por separado.
-- ================================================================

-- UUID helper (recomendado en Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 1) PROFILES: columnas Telegram + preferencia de notificaciones
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS notify_telegram_on_diagnosis BOOLEAN DEFAULT TRUE;

-- Asegurar unicidad de telegram_id (sin duplicar constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'u'
      AND a.attname = 'telegram_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_telegram_id_key UNIQUE (telegram_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);

-- ================================================================
-- 2) TELEGRAM SESSIONS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.telegram_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

DROP POLICY IF EXISTS "Allow service role full access to telegram_sessions"
  ON public.telegram_sessions;
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

-- ================================================================
-- 3) TELEGRAM LINK TOKENS (vinculacion)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT,
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '15 minutes',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Si tu tabla ya existia con NOT NULL, lo hacemos nullable (necesario: token se genera desde la web)
ALTER TABLE public.telegram_link_tokens
  ALTER COLUMN telegram_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS telegram_link_tokens_token_idx
  ON public.telegram_link_tokens(token);
CREATE INDEX IF NOT EXISTS telegram_link_tokens_telegram_id_idx
  ON public.telegram_link_tokens(telegram_id);
CREATE INDEX IF NOT EXISTS telegram_link_tokens_expires_at_idx
  ON public.telegram_link_tokens(expires_at);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to telegram_link_tokens"
  ON public.telegram_link_tokens;
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

-- ================================================================
-- 4) DEDUP: processed_webhook_messages soporta Telegram
-- ================================================================

ALTER TABLE public.processed_webhook_messages
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS telegram_id TEXT;

CREATE INDEX IF NOT EXISTS processed_webhook_messages_source_idx
  ON public.processed_webhook_messages(source);
CREATE INDEX IF NOT EXISTS processed_webhook_messages_telegram_idx
  ON public.processed_webhook_messages(telegram_id, source);

-- ================================================================
-- FIN
-- ================================================================
