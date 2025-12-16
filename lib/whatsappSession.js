import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Encuentra o crea una sesión para un teléfono
 * @param {string} phone - Número de teléfono normalizado (ej: +573001234567)
 * @param {string|null} userId - ID del usuario (null si no está registrado)
 * @returns {Promise<Object>} Sesión activa
 */
export async function getOrCreateSession(phone, userId = null) {
  if (!phone) {
    throw new Error('El número de teléfono es requerido');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutos

  // Intentar obtener sesión existente
  const { data: existingSession, error: readError } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (readError) {
    console.error('[whatsappSession] Error buscando sesión:', readError);
    throw new Error('Error al buscar sesión de WhatsApp');
  }

  // Si existe y no ha expirado, retornarla
  if (existingSession && new Date(existingSession.expires_at) > now) {
    return existingSession;
  }

  // Si existe pero expiró, eliminarla primero
  if (existingSession) {
    await supabaseAdmin
      .from('whatsapp_sessions')
      .delete()
      .eq('phone', phone);
  }

  // Crear nueva sesión
  const { data: newSession, error: createError } = await supabaseAdmin
    .from('whatsapp_sessions')
    .insert({
      phone,
      user_id: userId,
      state: 'idle',
      expires_at: expiresAt.toISOString(),
      last_message_at: now.toISOString(),
    })
    .select()
    .single();

  if (createError) {
    console.error('[whatsappSession] Error creando sesión:', createError);
    throw new Error('Error al crear sesión de WhatsApp');
  }

  return newSession;
}

/**
 * Actualiza el estado de una sesión
 * @param {string} phone - Número de teléfono
 * @param {string} newState - Nuevo estado (idle, awaiting_cultivo, awaiting_notes, awaiting_image, processing)
 * @param {Object} data - Datos adicionales a guardar (cultivo_name, notes, image_url)
 * @returns {Promise<Object>} Sesión actualizada
 */
export async function updateSessionState(phone, newState, data = {}) {
  if (!phone) {
    throw new Error('El número de teléfono es requerido');
  }

  const validStates = ['idle', 'awaiting_cultivo', 'awaiting_notes', 'awaiting_image', 'processing'];
  if (!validStates.includes(newState)) {
    throw new Error(`Estado inválido: ${newState}`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // Extender 30 minutos

  const updateData = {
    state: newState,
    last_message_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ...data, // cultivo_name, notes, image_url
  };

  const { data: updatedSession, error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .update(updateData)
    .eq('phone', phone)
    .select()
    .single();

  if (error) {
    console.error('[whatsappSession] Error actualizando sesión:', error);
    throw new Error('Error al actualizar sesión de WhatsApp');
  }

  return updatedSession;
}

/**
 * Obtiene la sesión activa de un teléfono
 * @param {string} phone - Número de teléfono
 * @returns {Promise<Object|null>} Sesión o null si no existe/expiró
 */
export async function getActiveSession(phone) {
  if (!phone) {
    return null;
  }

  const { data: session, error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    console.error('[whatsappSession] Error obteniendo sesión:', error);
    return null;
  }

  if (!session) {
    return null;
  }

  // Verificar si expiró
  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  if (expiresAt <= now) {
    // Sesión expirada, eliminarla
    await clearSession(phone);
    return null;
  }

  return session;
}

/**
 * Limpia (elimina) una sesión completada
 * @param {string} phone - Número de teléfono
 * @returns {Promise<void>}
 */
export async function clearSession(phone) {
  if (!phone) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .delete()
    .eq('phone', phone);

  if (error) {
    console.error('[whatsappSession] Error limpiando sesión:', error);
    throw new Error('Error al limpiar sesión de WhatsApp');
  }
}

/**
 * Extiende el tiempo de expiración de una sesión
 * @param {string} phone - Número de teléfono
 * @param {number} minutes - Minutos adicionales (default: 30)
 * @returns {Promise<void>}
 */
export async function extendSession(phone, minutes = 30) {
  if (!phone) {
    throw new Error('El número de teléfono es requerido');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);

  const { error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .update({
      expires_at: expiresAt.toISOString(),
      last_message_at: now.toISOString(),
    })
    .eq('phone', phone);

  if (error) {
    console.error('[whatsappSession] Error extendiendo sesión:', error);
    throw new Error('Error al extender sesión de WhatsApp');
  }
}
