# Troubleshooting: Integración WhatsApp con Whapi

## Problema: No hay comunicación con WhatsApp

### Lista de Verificación Rápida

- [ ] Variables de entorno configuradas en Vercel
- [ ] Redeploy realizado después de configurar variables
- [ ] Tabla `whatsapp_sessions` creada en Supabase
- [ ] Webhook configurado en Whapi dashboard
- [ ] Usuario tiene teléfono registrado en `profiles`
- [ ] Número de teléfono en formato correcto (+código país sin espacios)

---

## 1. Verificar Variables de Entorno en Vercel

### Ir a Vercel Dashboard
1. https://vercel.com/dashboard
2. Selecciona tu proyecto: `tec-rural-diagnostico`
3. Ve a **Settings** → **Environment Variables**

### Variables Requeridas:
```bash
WHAPI_TOKEN=5nYNGKJjpLz4g96MAFj2Jo7Rj3QvQVNS
WHAPI_API_URL=https://gate.whapi.cloud
WHAPI_BUSINESS_NUMBER=+34614242716
CRON_SECRET=0fb18a73376002b9ebe3ee3cadeaed7aee70955849e04618f481af0ea046c84f
NEXT_PUBLIC_API_BASE_URL=https://tec-rural-diagnostico.vercel.app
```

**IMPORTANTE:** Después de agregar o modificar variables, haz clic en **Deployments** → botón de tres puntos → **Redeploy**.

---

## 2. Crear Tabla en Supabase

### Ejecutar SQL
1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. **SQL Editor** → **New Query**
4. Copia el contenido de `supabase/whatsapp_sessions.sql`
5. Ejecuta el script

### Verificar Tabla Creada
```sql
-- Debe retornar la estructura de la tabla
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'whatsapp_sessions';

-- Debe retornar 0 filas (tabla vacía)
SELECT COUNT(*) FROM whatsapp_sessions;
```

### Verificar Función RPC
```sql
-- Debe retornar 0 (no hay sesiones expiradas aún)
SELECT cleanup_expired_whatsapp_sessions();
```

---

## 3. Configurar Webhook en Whapi

### Dashboard de Whapi
1. Ve a: https://whapi.cloud/dashboard
2. Selecciona tu canal/instancia de WhatsApp
3. **Settings** → **Webhooks**

### Configuración del Webhook:
```
Webhook URL: https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp
Method: POST
Events:
  ✅ messages (selecciona todos los eventos de mensajes)
  ✅ messages.post
Status: Enabled
```

### Probar Webhook
Whapi tiene un botón "Test Webhook" o "Send Test". Úsalo y deberías ver:
- **Status 200 OK**
- Respuesta: `{"success":true}`

---

## 4. Configurar Teléfono en Perfil de Usuario

### Verificar Perfiles
```sql
SELECT id, email, phone, credits_remaining, role
FROM profiles;
```

### Agregar/Actualizar Teléfono
```sql
UPDATE profiles
SET phone = '+34614242716'  -- REEMPLAZA con tu número completo
WHERE email = 'tu_email@example.com';  -- REEMPLAZA con tu email
```

**Formato correcto:**
- ✅ `+34614242716` (con + y código de país)
- ❌ `34614242716` (sin +)
- ❌ `+34 614 24 27 16` (con espacios)
- ❌ `+34-614-242-716` (con guiones)

---

## 5. Verificar Estado de Whapi

### API Health Check
```bash
curl -H "Authorization: Bearer 5nYNGKJjpLz4g96MAFj2Jo7Rj3QvQVNS" \
  https://gate.whapi.cloud/health
```

Debe retornar: `{"status":"ok"}` o similar

### Verificar Sesión de WhatsApp
En el dashboard de Whapi:
- **Status:** Connected (verde)
- **QR Code:** No debería aparecer (ya está conectado)

Si aparece QR Code, escanéalo con tu WhatsApp para conectar.

---

## 6. Revisar Logs de Vercel

### Acceder a Logs en Tiempo Real
1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. **Deployments** → selecciona el último deployment
4. **Functions** → **Runtime Logs**

### Buscar Errores Relacionados con WhatsApp
Filtra por:
- `[whatsapp-webhook]`
- `[whatsapp-session]`
- `[whatsapp-commands]`

### Errores Comunes:

**Error: "WHAPI_TOKEN no configurado"**
```
[whatsapp-webhook] Error: Configura WHAPI_TOKEN...
```
**Solución:** Agrega `WHAPI_TOKEN` en Vercel y redeploy.

**Error: "Usuario no registrado"**
```
[whatsapp-webhook] Usuario no registrado: +34614242716
```
**Solución:** Verifica que el teléfono esté en la tabla `profiles`.

**Error: "No se pudo obtener la imagen"**
```
[whatsapp-webhook] Error descargando media...
```
**Solución:** Verifica que `WHAPI_TOKEN` sea correcto.

---

## 7. Probar Manualmente el Webhook

### Usando curl
```bash
curl -X POST https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "from_me": false,
      "chat_id": "34614242716@s.whatsapp.net",
      "type": "text",
      "text": {
        "body": "/ayuda"
      }
    }]
  }'
```

**Respuesta esperada:**
```json
{"success":true}
```

Si obtienes un error, revisa los logs de Vercel.

---

## 8. Verificar Endpoints API

### Health Check de Endpoints

```bash
# Webhook de WhatsApp
curl https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp

# Debe retornar 405 Method Not Allowed (porque espera POST)
```

```bash
# Cron de Limpieza
curl -H "Authorization: Bearer 0fb18a73376002b9ebe3ee3cadeaed7aee70955849e04618f481af0ea046c84f" \
  https://tec-rural-diagnostico.vercel.app/api/cron/cleanup-sessions

# Debe retornar: {"success":true,"cleaned":0,"timestamp":"..."}
```

---

## 9. Flujo de Prueba Completo

### Paso a Paso:

1. **Envía mensaje desde WhatsApp:** `/ayuda`
2. **Verifica logs de Vercel:** Deberías ver `[whatsapp-webhook] Webhook recibido`
3. **Verifica que se autenticó:** `[whatsapp-webhook] Usuario autenticado: <user_id>`
4. **Verifica respuesta:** Deberías recibir el menú de ayuda en WhatsApp

### Si No Funciona:

**A) No aparece nada en logs de Vercel**
→ El webhook NO está llegando
→ Revisa configuración en Whapi dashboard

**B) Logs muestran "Usuario no registrado"**
→ El teléfono no está en `profiles`
→ Agrega el teléfono con el SQL de arriba

**C) Logs muestran errores de WHAPI_TOKEN**
→ Variable no configurada o incorrecta
→ Verifica en Vercel Settings → Environment Variables

**D) Logs muestran errores de Supabase**
→ Tabla no creada o RLS bloqueando
→ Ejecuta el SQL completo de nuevo

---

## 10. Comandos de Diagnóstico SQL

### Ver Sesiones Activas
```sql
SELECT * FROM whatsapp_sessions
ORDER BY created_at DESC;
```

### Ver Perfiles con Teléfono
```sql
SELECT id, email, phone, credits_remaining
FROM profiles
WHERE phone IS NOT NULL;
```

### Ver Últimos Diagnósticos por WhatsApp
```sql
SELECT id, user_id, cultivo_name, source, created_at
FROM diagnoses
WHERE source = 'whatsapp'
ORDER BY created_at DESC
LIMIT 10;
```

### Limpiar Sesiones Manualmente
```sql
-- Ver sesiones expiradas
SELECT * FROM whatsapp_sessions
WHERE expires_at < NOW();

-- Limpiar sesiones expiradas
SELECT cleanup_expired_whatsapp_sessions();
```

---

## 11. Checklist Final

Antes de contactar soporte, verifica:

- [ ] Todas las variables de entorno están en Vercel
- [ ] Hice redeploy después de agregar variables
- [ ] La tabla `whatsapp_sessions` existe en Supabase
- [ ] La función `cleanup_expired_whatsapp_sessions()` existe
- [ ] Mi teléfono está en `profiles` con formato +34XXXXXXXXX
- [ ] El webhook está configurado en Whapi con la URL correcta
- [ ] Whapi muestra estado "Connected" (verde)
- [ ] Los logs de Vercel NO muestran errores de variables faltantes
- [ ] Probé enviando `/ayuda` desde WhatsApp
- [ ] Revisé los logs de Vercel después de enviar el mensaje

---

## Contactos de Soporte

**Whapi Support:** https://whapi.cloud/support
**Supabase Support:** https://supabase.com/support
**Vercel Support:** https://vercel.com/help

---

## Recursos Adicionales

- [Documentación Whapi Webhooks](https://whapi.cloud/docs/webhooks)
- [Documentación Supabase RPC](https://supabase.com/docs/guides/database/functions)
- [Documentación Vercel Environment Variables](https://vercel.com/docs/environment-variables)
