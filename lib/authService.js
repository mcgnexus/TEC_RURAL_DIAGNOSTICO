import { supabase } from './supabaseBrowser.js';

/**
 * Servicio de autenticación con Supabase
 * Maneja login, logout, registro y gestión de sesiones
 */

export const authService = {
  /**
   * Registrar un nuevo usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña (mínimo 6 caracteres)
   * @returns {Promise<{user, session, error}>}
   */
  async signup(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { user: null, session: null, error: error.message };
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error.message,
      };
    }
  },

  /**
   * Iniciar sesión con email y contraseña
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña
   * @returns {Promise<{user, session, error}>}
   */
  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, session: null, error: error.message };
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error.message,
      };
    }
  },

  /**
   * Cerrar sesión
   * @returns {Promise<{error}>}
   */
  async logout() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      return { error: error.message };
    }
  },

  /**
   * Obtener la sesión actual
   * @returns {Promise<{session, user, error}>}
   */
  async getSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        return { session: null, user: null, error: error.message };
      }

      return {
        session,
        user: session?.user || null,
        error: null,
      };
    } catch (error) {
      return { session: null, user: null, error: error.message };
    }
  },

  /**
   * Obtener el usuario actualmente autenticado
   * @returns {Promise<{user, error}>}
   */
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        return { user: null, error: error.message };
      }

      return { user, error: null };
    } catch (error) {
      return { user: null, error: error.message };
    }
  },

  /**
   * Suscribirse a cambios de autenticación
   * @param {function} callback - Función que se ejecuta cuando cambia el estado de autenticación
   * @returns {function} Función para desuscribirse
   */
  onAuthStateChange(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    // Retornar función para desuscribirse
    return () => subscription?.unsubscribe();
  },

  /**
   * Enviar email de recuperación de contraseña
   * @param {string} email - Email del usuario
   * @returns {Promise<{error}>}
   */
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      return { error: error.message };
    }
  },
};
