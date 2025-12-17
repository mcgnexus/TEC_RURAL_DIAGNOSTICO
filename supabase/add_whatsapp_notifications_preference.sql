-- Agregar columna para controlar notificaciones de WhatsApp
-- Permite a los usuarios optar por no recibir notificaciones de diagnósticos desde la web en WhatsApp

ALTER TABLE profiles
ADD COLUMN notify_whatsapp_on_diagnosis BOOLEAN DEFAULT true;

-- Comentario descriptivo
COMMENT ON COLUMN profiles.notify_whatsapp_on_diagnosis IS
'Controla si el usuario recibe notificaciones automáticas en WhatsApp cuando realiza diagnósticos desde la web. Por defecto true para mantener compatibilidad con comportamiento anterior.';
