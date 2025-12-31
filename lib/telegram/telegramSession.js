import { supabaseAdmin } from '../supabaseAdmin.js';

/**
 * Encuentra o crea una sesión para un usuario de Telegram
 * @param {string} telegramId - ID del usuario de Telegram
 * @param {string|null} userId - ID del usuario en profiles (null si no está registrado)
 * @returns {Promise<Object>} Sesión activa
 */
export async function getOrCreateSession(telegramId, userId = null) {
  if (!telegramId) {
    throw new Error('El ID de Telegram es requerido');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutos

  // Intentar obtener sesión existente
  const { data: existingSession, error: readError } = await supabaseAdmin
    .from('telegram_sessions')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (readError) {
    console.error('[telegramSession] Error buscando sesión:', readError);
    throw new Error('Error al buscar sesión de Telegram');
  }

  // Si existe y no ha expirado, retornarla
  if (existingSession && new Date(existingSession.expires_at) > now) {
    return existingSession;
  }

  // Si existe pero expiró, eliminarla primero
  if (existingSession) {
    await supabaseAdmin
      .from('telegram_sessions')
      .delete()
      .eq('telegram_id', telegramId);
  }

  // Crear nueva sesión
  const { data: newSession, error: createError } = await supabaseAdmin
    .from('telegram_sessions')
    .insert({
      telegram_id: telegramId,
      user_id: userId,
      state: 'idle',
      expires_at: expiresAt.toISOString(),
      last_activity: now.toISOString(),
    })
    .select()
    .single();

  if (createError) {
    console.error('[telegramSession] Error creando sesión:', createError);
    throw new Error('Error al crear sesión de Telegram');
  }

  return newSession;
}

/**
 * Actualiza el estado de una sesión
 * @param {string} telegramId - ID del usuario de Telegram
 * @param {string} newState - Nuevo estado (idle, awaiting_cultivo, awaiting_notes, awaiting_image, processing)
 * @param {Object} data - Datos adicionales a guardar (cultivo_name, user_notes)
 * @returns {Promise<Object>} Sesión actualizada
 */
export async function updateSessionState(telegramId, newState, data = {}) {
  if (!telegramId) {
    throw new Error('El ID de Telegram es requerido');
  }

  const validStates = [
    'idle',
    'awaiting_cultivo',
    'awaiting_notes',
    'awaiting_image',
    'processing'
  ];
  if (!validStates.includes(newState)) {
    throw new Error(`Estado inválido: ${newState}`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // Extender 30 minutos

  const updateData = {
    state: newState,
    last_activity: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    updated_at: now.toISOString(),
    ...data, // cultivo_name, user_notes
  };

  const { data: updatedSession, error } = await supabaseAdmin
    .from('telegram_sessions')
    .update(updateData)
    .eq('telegram_id', telegramId)
    .select()
    .single();

  if (error) {
    console.error('[telegramSession] Error actualizando sesión:', error);
    throw new Error('Error al actualizar sesión de Telegram');
  }

  return updatedSession;
}

/**
 * Obtiene la sesión activa de un usuario de Telegram
 * @param {string} telegramId - ID del usuario de Telegram
 * @returns {Promise<Object|null>} Sesión o null si no existe/expiró
 */
export async function getActiveSession(telegramId) {
  if (!telegramId) {
    return null;
  }

  const { data: session, error } = await supabaseAdmin
    .from('telegram_sessions')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    console.error('[telegramSession] Error obteniendo sesión:', error);
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
    await clearSession(telegramId);
    return null;
  }

  return session;
}

/**
 * Limpia (elimina) una sesión completada
 * @param {string} telegramId - ID del usuario de Telegram
 * @returns {Promise<void>}
 */
export async function clearSession(telegramId) {
  if (!telegramId) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('telegram_sessions')
    .delete()
    .eq('telegram_id', telegramId);

  if (error) {
    console.error('[telegramSession] Error limpiando sesión:', error);
    throw new Error('Error al limpiar sesión de Telegram');
  }
}

/**
 * Extiende el tiempo de expiración de una sesión
 * @param {string} telegramId - ID del usuario de Telegram
 * @param {number} minutes - Minutos adicionales (default: 30)
 * @returns {Promise<void>}
 */
export async function extendSession(telegramId, minutes = 30) {
  if (!telegramId) {
    throw new Error('El ID de Telegram es requerido');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);

  const { error } = await supabaseAdmin
    .from('telegram_sessions')
    .update({
      expires_at: expiresAt.toISOString(),
      last_activity: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('telegram_id', telegramId);

  if (error) {
    console.error('[telegramSession] Error extendiendo sesión:', error);
    throw new Error('Error al extender sesión de Telegram');
  }
}

/**
 * Actualiza el estado de registro de una sesión
 * @param {string} telegramId - ID del usuario de Telegram
 * @param {string} registrationState - Estado del registro
 * @param {Object} registrationData - Datos del registro en progreso
 * @returns {Promise<Object>} Sesión actualizada
 */
export async function updateRegistrationState(telegramId, registrationState, registrationData = {}) {
  if (!telegramId) {
    throw new Error('El ID de Telegram es requerido');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  const updateData = {
    state: 'registration',
    registration_state: registrationState,
    registration_data: registrationData,
    last_activity: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data: updatedSession, error } = await supabaseAdmin
    .from('telegram_sessions')
    .update(updateData)
    .eq('telegram_id', telegramId)
    .select()
    .single();

  if (error) {
    console.error('[telegramSession] Error actualizando estado de registro:', error);
    throw new Error('Error al actualizar estado de registro');
  }

  return updatedSession;
}
