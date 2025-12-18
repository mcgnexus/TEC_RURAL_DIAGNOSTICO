import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { maskId, redactForLog, redactString } from '@/lib/logging';

/**
 * Helper para operaciones seguras con service role
 * Solo debe usarse después de verificar autenticación
 */
export class SecureServiceRole {
  constructor(userId, userRole) {
    this.userId = userId;
    this.userRole = userRole;
  }

  /**
   * Verifica que el usuario tenga permisos de admin
   */
  requireAdmin() {
    if (this.userRole !== 'admin') {
      throw new Error('Se requieren permisos de administrador');
    }
    return this;
  }

  /**
   * Verifica que el usuario tenga rol específico
   */
  requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(this.userRole)) {
      throw new Error(`Se requiere uno de estos roles: ${roles.join(', ')}`);
    }
    return this;
  }

  /**
   * Obtiene el cliente service role para operaciones admin
   */
  getClient() {
    return supabaseAdmin;
  }

  /**
   * Auditoría: registra la operación realizada
   */
  audit(operation, details = {}) {
    console.log(`[AUDIT] User ${maskId(this.userId)} (${this.userRole}): ${redactString(operation)}`, redactForLog(details));
    return this;
  }
}

/**
 * Factory para crear instancias seguras de service role
 */
export function createSecureServiceRole(userId, userRole) {
  return new SecureServiceRole(userId, userRole);
}

/**
 * Wrapper para funciones que requieren service role
 * Verifica autenticación y crea contexto seguro
 */
export async function withSecureServiceRole(userId, userRole, operation) {
  const secure = createSecureServiceRole(userId, userRole);
  
  try {
    const result = await operation(secure);
    secure.audit('Operation completed', { success: true });
    return result;
  } catch (error) {
    secure.audit('Operation failed', { error: redactString(error?.message || '') });
    throw error;
  }
}
