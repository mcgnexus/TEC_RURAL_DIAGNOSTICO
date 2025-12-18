-- ================================================================
-- TABLA DE TOKENS DE VINCULACIÓN TELEGRAM
-- ================================================================
-- Permite vincular cuentas existentes con usuarios de Telegram
-- mediante un token temporal generado desde la web

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '15 minutes',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS telegram_link_tokens_token_idx
  ON public.telegram_link_tokens(token);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_telegram_id_idx
  ON public.telegram_link_tokens(telegram_id);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_expires_at_idx
  ON public.telegram_link_tokens(expires_at);

-- Política de seguridad RLS
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to telegram_link_tokens"
  ON public.telegram_link_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Función para limpiar tokens expirados
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

-- Comentarios para documentación
COMMENT ON TABLE telegram_link_tokens IS 'Tokens temporales para vincular cuentas web con Telegram';
COMMENT ON COLUMN telegram_link_tokens.token IS 'Token único generado para vinculación (6 caracteres alfanuméricos)';
COMMENT ON COLUMN telegram_link_tokens.expires_at IS 'Los tokens expiran después de 15 minutos';
