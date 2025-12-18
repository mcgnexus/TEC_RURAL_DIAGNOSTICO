-- ================================================================
-- EXTENDER DEDUPLICACIÓN DE MENSAJES PARA TELEGRAM
-- ================================================================
-- Permite que la tabla processed_webhook_messages soporte
-- tanto WhatsApp como Telegram

-- Agregar columnas para Telegram
ALTER TABLE processed_webhook_messages
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS telegram_id TEXT;

-- Índice para búsquedas por source
CREATE INDEX IF NOT EXISTS processed_webhook_messages_source_idx
  ON public.processed_webhook_messages(source);

-- Índice compuesto para telegram_id + source
CREATE INDEX IF NOT EXISTS processed_webhook_messages_telegram_idx
  ON public.processed_webhook_messages(telegram_id, source);

-- Comentarios para documentación
COMMENT ON COLUMN processed_webhook_messages.source IS 'Origen del mensaje: whatsapp o telegram';
COMMENT ON COLUMN processed_webhook_messages.telegram_id IS 'ID de usuario de Telegram (si aplica)';
