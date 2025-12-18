-- ================================================================
-- AGREGAR SOPORTE PARA TELEGRAM EN PROFILES
-- ================================================================

-- Agregar columnas para usuarios de Telegram
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telegram_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT;

-- Índice para búsquedas rápidas por telegram_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);

-- Comentarios para documentación
COMMENT ON COLUMN profiles.telegram_id IS 'ID único de usuario de Telegram (chat_id)';
COMMENT ON COLUMN profiles.telegram_username IS 'Username de Telegram (sin @)';
