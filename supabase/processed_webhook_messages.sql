-- Tabla para rastrear mensajes de webhook ya procesados
-- Previene que el mismo mensaje sea procesado múltiples veces
-- si el webhook se recibe varias veces

CREATE TABLE IF NOT EXISTS public.processed_webhook_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas por message_id
CREATE INDEX IF NOT EXISTS processed_webhook_messages_message_id_idx
  ON public.processed_webhook_messages(message_id);

-- Índice para búsquedas por teléfono
CREATE INDEX IF NOT EXISTS processed_webhook_messages_phone_idx
  ON public.processed_webhook_messages(phone);

-- Política de seguridad RLS (permitir acceso del service role)
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access"
  ON public.processed_webhook_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);
