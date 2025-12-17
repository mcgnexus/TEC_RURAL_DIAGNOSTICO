# Preferencia de Notificaciones WhatsApp

## Descripción

Los usuarios pueden ahora controlar si desean recibir notificaciones automáticas de diagnósticos en WhatsApp cuando realizan diagnósticos desde la aplicación web.

## Columna de Base de Datos

**Tabla:** `profiles`
**Columna:** `notify_whatsapp_on_diagnosis`
**Tipo:** BOOLEAN
**Valor por defecto:** true
**Descripción:** Controla si el usuario recibe notificaciones en WhatsApp cuando realiza diagnósticos desde la web.

## Comportamiento

### Antes (Sin Control)
- ✅ Usuario hace diagnóstico en web
- ✅ Sistema completa el diagnóstico
- ✅ Se **envía automáticamente** notificación en WhatsApp
- ⚠️ Notificación redundante si usuario está en la app

### Después (Con Control)
- ✅ Usuario hace diagnóstico en web
- ✅ Sistema completa el diagnóstico
- 🔍 Se verifica la preferencia del usuario
- ✅ Notificación se envía SOLO si está habilitada
- 🎯 Usuario tiene control total

## Estados

| Valor | Comportamiento | Caso de Uso |
|-------|----------------|-----------|
| `true` (defecto) | **Envía notificación** en WhatsApp | Usuario quiere recordatorios en WhatsApp |
| `false` | **NO envía notificación** | Usuario prefiere solo la app web |
| `null` (sin teléfono) | **NO envía** | Usuario no tiene teléfono registrado |

## Logs

El sistema registra tres tipos de eventos:

```
[diagnose] Notificación WhatsApp enviada a: +57XXXXXXXXXX
[diagnose] Notificación WhatsApp omitida: usuario deshabilitó notificaciones
[diagnose] No se envió notificación WhatsApp: usuario sin teléfono registrado
```

## Implementación en UI (Opcional)

### Componente de Preferencias en Perfil

Para que los usuarios cambien esta preferencia, agregar en la página de perfil:

```jsx
// Opción 1: Toggle Switch
<label>
  <input
    type="checkbox"
    checked={profile?.notify_whatsapp_on_diagnosis !== false}
    onChange={(e) => updateNotificationPreference(e.target.checked)}
  />
  Recibir diagnósticos en WhatsApp
</label>

// Opción 2: Usando API
async function updateNotificationPreference(enabled) {
  await supabase
    .from('profiles')
    .update({ notify_whatsapp_on_diagnosis: enabled })
    .eq('id', user.id);
}
```

## Compatibilidad

✅ **Retrocompatible**: Los usuarios existentes mantendrán el valor por defecto (`true`), preservando el comportamiento anterior.

## Migración Requerida

Ejecutar en Supabase SQL Editor:

```sql
ALTER TABLE profiles
ADD COLUMN notify_whatsapp_on_diagnosis BOOLEAN DEFAULT true;
```

O usar el script: `supabase/add_whatsapp_notifications_preference.sql`

## Código Relacionado

- **Lógica de notificación:** [`app/api/diagnose/route.js`](app/api/diagnose/route.js#L99-L142)
- **Script SQL:** [`supabase/add_whatsapp_notifications_preference.sql`](supabase/add_whatsapp_notifications_preference.sql)

## Próximas Mejoras

- [ ] Agregar UI en página de perfil para cambiar la preferencia
- [ ] Enviar confirmación en WhatsApp cuando se cambia la preferencia
- [ ] Agregar más granularidad: notificaciones por tipo de diagnóstico
- [ ] Permitir horarios específicos para notificaciones
