# 🔧 Debug WhatsApp - Guía de Troubleshooting

## 🚨 Problema: No se reciben mensajes de WhatsApp

---

## 🎯 Checklist de Verificación (En orden de prioridad)

### ✅ PASO 1: Verificar Configuración en Whapi Dashboard

**URL:** https://whapi.cloud/dashboard

**¿Qué verificar?**

1. **Webhook URL**
   - [ ] La URL es exactamente: `https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp`
   - [ ] (NO `http://localhost`)
   - [ ] (NO `https://tec-rural-diagnostico.vercel.app/webhooks/whatsapp` - falta `/api`)

2. **Estado del Webhook**
   - [ ] Status está en verde ("Enabled")
   - [ ] NO está en rojo ("Disabled")

3. **Eventos Seleccionados**
   - [ ] "messages" está seleccionado
   - [ ] "messages.post" está seleccionado

4. **Conexión de Whapi**
   - [ ] En la parte superior, el status es "Connected" (verde)
   - [ ] Si muestra **QR code**, necesitas **escanear con WhatsApp** para reconectar
   - [ ] NO hay mensaje de error rojo

5. **Test del Webhook (Opcional pero recomendado)**
   - [ ] Busca botón "Test" o "Send Test"
   - [ ] Envía un webhook de prueba
   - [ ] Verifica que retorne: `{"success": true}`

**Si TODOS los pasos están OK, pasa al PASO 2**

---

### ✅ PASO 2: Verificar Variables en Vercel

**URL:** https://vercel.com/dashboard

**¿Qué verificar?**

1. **Accede al Proyecto**
   - [ ] Selecciona proyecto `tec-rural-diagnostico`
   - [ ] Ve a **Settings** (engranaje)
   - [ ] Click en **Environment Variables**

2. **Variables Requeridas (Agrega si NO existen)**
   ```
   WHAPI_TOKEN = "5nYNGKJjpLz4g96MAFj2Jo7Rj3QvQVNS"
   WHAPI_API_URL = "https://gate.whapi.cloud"
   WHAPI_BUSINESS_NUMBER = "+34614242716"
   NEXT_PUBLIC_API_BASE_URL = "https://tec-rural-diagnostico.vercel.app"
   ```

3. **Verifica cada una**
   - [ ] WHAPI_TOKEN existe
   - [ ] WHAPI_API_URL existe
   - [ ] WHAPI_BUSINESS_NUMBER existe
   - [ ] NEXT_PUBLIC_API_BASE_URL = `https://tec-rural-diagnostico.vercel.app` (NO localhost)

4. **Si faltaban variables o estaban incorrectas:**
   - [ ] Ve a **Deployments**
   - [ ] Haz clic en **"..."** del último deployment
   - [ ] Selecciona **"Redeploy"**
   - [ ] Espera a que compile (2-3 minutos)

**Si TODOS los pasos están OK, pasa al PASO 3**

---

### ✅ PASO 3: Verificar Usuario en Supabase

**URL:** https://supabase.com/dashboard

**¿Qué verificar?**

1. **Accede a tu Proyecto**
   - [ ] Selecciona: `yvepuccjiaktluxcpadk`
   - [ ] Ve a **SQL Editor**

2. **Busca tu usuario**
   ```sql
   SELECT id, email, phone, credits_remaining
   FROM profiles
   WHERE email = 'tu_email@example.com';
   ```
   - [ ] Ejecuta el query
   - [ ] Verifica que `phone` NO sea NULL
   - [ ] Verifica que sea formato: `+34614242716` (con `+`)
   - [ ] Verifica que `credits_remaining > 0`

3. **Si el teléfono es NULL, agrégalo:**
   ```sql
   UPDATE profiles
   SET phone = '+34614242716'
   WHERE email = 'tu_email@example.com';
   ```

4. **Si no tiene créditos, agrégalos:**
   ```sql
   UPDATE profiles
   SET credits_remaining = 10
   WHERE email = 'tu_email@example.com';
   ```

**Si TODOS los pasos están OK, pasa al PASO 4**

---

### ✅ PASO 4: Verificar Tablas en Supabase

**En el SQL Editor, ejecuta:**

```sql
-- Verificar que tabla existe
SELECT COUNT(*) FROM whatsapp_sessions;

-- Verificar que tabla de deduplicación existe
SELECT COUNT(*) FROM processed_webhook_messages;

-- Ver estructura
\d whatsapp_sessions
```

- [ ] Ambas tablas existen
- [ ] NO hay errores de "table not found"

**Si hay errores, necesitas aplicar las migraciones:**

1. Ve a SQL Editor → New Query
2. Copia contenido de: `supabase/whatsapp_sessions.sql`
3. Ejecuta
4. Repite con: `supabase/processed_webhook_messages.sql` (si necesita extensiones)

---

### ✅ PASO 5: Verificar Conexión Local

**En tu terminal:**

```bash
npm run dev
```

- [ ] La aplicación inicia sin errores
- [ ] Puerto 3000 está disponible

**Envía un test desde WhatsApp local:**

```bash
# En otra terminal, ejecuta:
node scripts/test-whatsapp-integration.js
```

Esto verificará:
- ✅ Variables de entorno
- ✅ Conexión con Whapi
- ✅ Conexión con Supabase
- ✅ Tablas necesarias
- ✅ Función RPC

**Busca errores en la salida**

---

## 🔍 Verificación del Webhook en Funcionamiento

### Test Manual:

1. **Abre la aplicación:**
   ```
   http://localhost:3000
   ```

2. **En tu terminal, deberías ver:**
   ```
   [whatsapp-webhook] Webhook recibido: {...}
   ```

3. **Envía un mensaje de prueba desde WhatsApp:**
   - Escribe un mensaje simple: "Hola"
   - Espera 5 segundos
   - Revisa la terminal

**Esperas ver logs como:**
```
[whatsapp-webhook] Webhook recibido: {"messages": [...]}
[whatsapp-webhook] Procesando mensaje de +34614242716
[whatsapp-webhook] Usuario autenticado: abc123...
[whatsapp-webhook] Diagnóstico rápido completado
```

---

## 🐛 Errores Comunes y Soluciones

### Error: "Usuario no registrado"
```
[whatsapp-webhook] Usuario no registrado: +34614242716
```
**Solución:** Agregar teléfono a perfil en Supabase
```sql
UPDATE profiles SET phone = '+34614242716' WHERE email = '...';
```

---

### Error: "No tienes créditos disponibles"
```
[whatsapp-webhook] Error: No tienes créditos disponibles
```
**Solución:** Agregar créditos
```sql
UPDATE profiles SET credits_remaining = 10 WHERE email = '...';
```

---

### Error: "No se encontró URL de imagen"
**Causa:** Problema al descargar imagen de Whapi
**Solución:**
1. Verifica que WHAPI_TOKEN es correcto
2. Verifica que imagen sea válida (JPG, PNG)
3. Revisa logs de Vercel

---

### Error: "Error consultando perfil"
**Causa:** Problema de conexión con Supabase
**Solución:**
1. Verifica NEXT_PUBLIC_SUPABASE_URL
2. Verifica SUPABASE_SERVICE_ROLE_KEY
3. Verifica que la BD esté online

---

## 📊 Verificar Logs en Vercel

**Productor:**

1. Ve a https://vercel.com/dashboard
2. Proyecto `tec-rural-diagnostico`
3. Click en el último **Deployment**
4. Tab **Runtime Logs**
5. Envía mensaje desde WhatsApp
6. Busca logs con `[whatsapp-webhook]`

**Esperadas ver:**
```
[whatsapp-webhook] Webhook recibido: {...}
[whatsapp-webhook] Procesando mensaje de ...
[whatsapp-webhook] Diagnóstico completado
```

---

## ✅ Checklist Final (Todo Debe Estar OK)

- [ ] Webhook configurado en Whapi (URL correcta)
- [ ] Webhook habilitado en Whapi (status verde)
- [ ] Variables de entorno en Vercel
- [ ] NEXT_PUBLIC_API_BASE_URL es HTTPS (no localhost)
- [ ] Usuario tiene teléfono en Supabase
- [ ] Usuario tiene créditos > 0
- [ ] Tablas de sesión existen
- [ ] Whapi conectado (no QR)
- [ ] Aplicación reiniciada después de cambios

**Si TODOS están OK, WhatsApp debe funcionar perfectamente** ✅

---

## 🆘 Si Aún No Funciona

1. Ejecuta el script de prueba:
   ```bash
   node scripts/test-whatsapp-integration.js
   ```

2. Revisa los errores específicos que reporta

3. Envía screenshot de:
   - Dashboard de Whapi (configuración del webhook)
   - Vercel (Environment Variables)
   - Terminal (salida de test-whatsapp-integration.js)

---

**Última actualización:** 2025-12-18
**Versión:** 1.0
