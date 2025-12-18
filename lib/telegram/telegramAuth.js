import { supabaseAdmin } from '../supabaseAdmin.js';
import crypto from 'crypto';
import { maskId, redactForLog } from '../logging.js';

/**
 * Busca un usuario por su ID de Telegram
 * @param {string} telegramId - ID del usuario de Telegram
 * @returns {Promise<Object|null>} Perfil del usuario o null si no existe
 */
export async function findUserByTelegramId(telegramId) {
  if (!telegramId) {
    return null;
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    console.error('[telegramAuth] Error buscando usuario por telegram_id:', redactForLog(error));
    return null;
  }

  return profile;
}

/**
 * Genera un token único para vincular una cuenta de Telegram
 * @param {string} telegramId - ID del usuario de Telegram
 * @param {string} userId - ID del usuario en profiles (opcional, para pre-vinculación)
 * @returns {Promise<string>} Token generado (6 caracteres alfanuméricos)
 */
export async function generateLinkToken(telegramId, userId = null) {
  if (!telegramId) {
    throw new Error('El ID de Telegram es requerido');
  }

  // Generar token alfanumérico de 6 caracteres
  const token = crypto.randomBytes(3).toString('hex').toUpperCase();

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  const { data, error } = await supabaseAdmin
    .from('telegram_link_tokens')
    .insert({
      telegram_id: telegramId,
      token,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[telegramAuth] Error creando token de vinculación:', redactForLog(error));
    throw new Error('Error al generar token de vinculación');
  }

  return token;
}

/**
 * Valida un token de vinculación y vincula la cuenta
 * @param {string} token - Token a validar
 * @param {string} userId - ID del usuario que está vinculando
 * @returns {Promise<Object>} Resultado de la validación
 */
export async function validateAndLinkToken(token, userId) {
  if (!token || !userId) {
    throw new Error('Token y userId son requeridos');
  }

  // Buscar el token
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from('telegram_link_tokens')
    .select('*')
    .eq('token', token.toUpperCase())
    .eq('used', false)
    .maybeSingle();

  if (tokenError) {
    console.error('[telegramAuth] Error buscando token:', redactForLog(tokenError));
    throw new Error('Error al validar token');
  }

  if (!tokenData) {
    return {
      success: false,
      error: 'Token inválido o ya usado',
    };
  }

  // Verificar expiración
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);

  if (expiresAt <= now) {
    return {
      success: false,
      error: 'Token expirado',
    };
  }

  // Vincular telegram_id al perfil del usuario
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      telegram_id: tokenData.telegram_id,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[telegramAuth] Error vinculando telegram_id:', redactForLog(updateError));
    throw new Error('Error al vincular telegram_id');
  }

  // Marcar token como usado
  await supabaseAdmin
    .from('telegram_link_tokens')
    .update({ used: true })
    .eq('token', token.toUpperCase());

  return {
    success: true,
    telegramId: tokenData.telegram_id,
  };
}

/**
 * Crea un nuevo usuario desde Telegram
 * @param {Object} userData - Datos del usuario
 * @param {string} userData.telegramId - ID de Telegram
 * @param {string} userData.telegramUsername - Username de Telegram (opcional)
 * @param {string} userData.firstName - Primer nombre
 * @param {string} userData.lastName - Apellido (opcional)
 * @param {string} userData.email - Email
 * @param {string} userData.phone - Teléfono (opcional)
 * @returns {Promise<Object>} Usuario creado
 */
export async function createUserFromTelegram(userData) {
  const { telegramId, telegramUsername, firstName, lastName, email, phone } = userData;

  if (!telegramId || !firstName || !email) {
    throw new Error('telegramId, firstName y email son requeridos');
  }

  // Verificar que no exista ya un usuario con ese telegram_id
  const existing = await findUserByTelegramId(telegramId);
  if (existing) {
    throw new Error('Ya existe un usuario con este ID de Telegram');
  }

  // Verificar que no exista un usuario con ese email
  const { data: existingEmail } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingEmail) {
    throw new Error('Ya existe un usuario con este email');
  }

  // Crear el perfil
  const { data: newProfile, error: createError } = await supabaseAdmin
    .from('profiles')
    .insert({
      telegram_id: telegramId,
      telegram_username: telegramUsername || null,
      first_name: firstName,
      last_name: lastName || null,
      email: email,
      phone: phone || null,
      credits_remaining: 5, // Créditos de prueba
      role: 'user',
    })
    .select()
    .single();

  if (createError) {
    console.error('[telegramAuth] Error creando usuario:', redactForLog(createError));
    throw new Error('Error al crear usuario: ' + createError.message);
  }

  console.log('[telegramAuth] Usuario creado desde Telegram', { id: maskId(newProfile.id) });

  return newProfile;
}

/**
 * Actualiza el telegram_username de un usuario existente
 * @param {string} telegramId - ID de Telegram
 * @param {string} telegramUsername - Username de Telegram
 * @returns {Promise<void>}
 */
export async function updateTelegramUsername(telegramId, telegramUsername) {
  if (!telegramId) {
    return;
  }

  await supabaseAdmin
    .from('profiles')
    .update({
      telegram_username: telegramUsername || null,
    })
    .eq('telegram_id', telegramId);
}

/**
 * Verifica si un email ya está registrado
 * @param {string} email - Email a verificar
 * @returns {Promise<boolean>} true si ya existe
 */
export async function emailExists(email) {
  if (!email) {
    return false;
  }

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  return !!data;
}

/**
 * Obtiene el perfil completo de un usuario por telegram_id
 * Incluye información de créditos y configuración
 * @param {string} telegramId - ID de Telegram
 * @returns {Promise<Object|null>} Perfil completo o null
 */
export async function getFullProfile(telegramId) {
  if (!telegramId) {
    return null;
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, phone, telegram_id, telegram_username, credits_remaining, role, notify_whatsapp_on_diagnosis')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    console.error('[telegramAuth] Error obteniendo perfil completo:', redactForLog(error));
    return null;
  }

  return profile;
}
