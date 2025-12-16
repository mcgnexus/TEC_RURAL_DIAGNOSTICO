# Configuración del Webhook en Whapi - Guía Paso a Paso

## 🚨 Problema Común: Mensajes No Llegan

Si todo está configurado correctamente EXCEPTO que los mensajes no llegan, el problema es **100% la configuración del webhook en Whapi**.

---

## ✅ Pasos para Configurar el Webhook en Whapi

### 1. Acceder al Dashboard de Whapi

Ve a: **https://whapi.cloud/dashboard** (o https://gate.whapi.cloud/dashboard)

### 2. Seleccionar tu Canal/Instancia

En el dashboard, deberías ver tu instancia de WhatsApp. Asegúrate de que:
- **Status:** Connected (verde) ✅
- Si está desconectado, escanea el QR code nuevamente

### 3. Ir a Configuración de Webhooks

Busca una opción llamada:
- "Webhooks"
- "Settings" → "Webhooks"
- "Configuration" → "Webhooks"

(La ubicación exacta depende de la interfaz de Whapi)

### 4. Configurar el Webhook

**URL del Webhook:**
```
https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp
```

**Método HTTP:**
```
POST
```

**Eventos a Suscribir:**

Marca TODOS estos eventos relacionados con mensajes:
- ✅ `messages`
- ✅ `messages.post`
- ✅ `message.create`
- ✅ `message.new`

(Los nombres exactos pueden variar, pero selecciona cualquier evento que mencione "messages" o "incoming")

**Headers (si aplica):**
```
Content-Type: application/json
```

**Estado:**
```
✅ Enabled / Active
```

### 5. Guardar y Probar

Después de guardar:

1. Busca un botón "Test Webhook" o "Send Test"
2. Click en él
3. Deberías ver:
   - Status: `200 OK`
   - Response: `{"success":true}`

---

## 🔍 Verificar que el Webhook Está Funcionando

### Opción A: Desde Whapi Dashboard

Muchos dashboards de Whapi tienen una sección de "Webhook Logs" o "Recent Webhooks" que muestra:
- ✅ Webhooks enviados exitosamente (200)
- ❌ Webhooks fallidos (4xx, 5xx)

### Opción B: Enviar Mensaje de Prueba

1. Envía un mensaje desde WhatsApp: `Hola`
2. Ve al dashboard de Whapi
3. Verifica que en "Webhook Logs" aparezca un registro con:
   - URL: `https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp`
   - Status: `200`
   - Timestamp: Ahora mismo

### Opción C: Ver Logs de Vercel

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. **Deployments** → último deployment → **Runtime Logs**
4. Envía un mensaje desde WhatsApp
5. Deberías ver logs con `[whatsapp-webhook] Webhook recibido`

**SI NO VES NADA EN LOS LOGS DE VERCEL:**
→ El webhook NO está enviando datos
→ El problema está en la configuración de Whapi

---

## 🐛 Problemas Comunes en Whapi

### Problema 1: Webhook No Configurado
**Síntoma:** No hay logs en Vercel al enviar mensajes
**Solución:** Configurar el webhook como se indica arriba

### Problema 2: URL Incorrecta
**Síntoma:** Logs de Whapi muestran error 404
**Verificar:**
```
✅ https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp
❌ https://tec-rural-diagnostico.vercel.app/webhooks/whatsapp
❌ https://tec-rural-diagnostico.vercel.app/api/webhook/whatsapp
```

### Problema 3: Eventos No Seleccionados
**Síntoma:** Algunos mensajes llegan, otros no
**Solución:** Seleccionar TODOS los eventos de mensajes

### Problema 4: Webhook Deshabilitado
**Síntoma:** Funcionaba antes, ahora no
**Solución:** Verificar que el toggle esté en "Enabled"

### Problema 5: Whapi Desconectado
**Síntoma:** Webhook configurado pero no funciona
**Solución:** Reconectar WhatsApp escaneando QR

---

## 🧪 Prueba Manual del Endpoint

Para verificar que tu endpoint funciona, ejecuta desde tu proyecto:

```bash
node scripts/test-webhook-endpoint.js
```

Esto hará una petición simulada al webhook. Si responde `{"success":true}`, el endpoint funciona.

---

## 📸 Screenshots de Referencia

Busca en el dashboard de Whapi algo similar a:

### Configuración Correcta:
```
┌─────────────────────────────────────────────────┐
│ Webhook Configuration                           │
├─────────────────────────────────────────────────┤
│ URL: https://tec-rural-diagnostico.vercel.app   │
│      /api/webhooks/whatsapp                     │
│                                                 │
│ Method: POST                                    │
│                                                 │
│ Events:                                         │
│ ✅ messages.post                                │
│ ✅ messages.create                              │
│                                                 │
│ Status: 🟢 Enabled                              │
│                                                 │
│ [Test Webhook] [Save]                           │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Alternativa: Verificar con la API de Whapi

Si tienes acceso a la API de Whapi, verifica la configuración del webhook:

```bash
curl -H "Authorization: Bearer 5nYNGKJjpLz4g96MAFj2Jo7Rj3QvQVNS" \
  https://gate.whapi.cloud/settings/webhook
```

Debería retornar algo como:
```json
{
  "webhook": {
    "url": "https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp",
    "events": ["messages"],
    "enabled": true
  }
}
```

---

## ✅ Checklist Final

Antes de continuar debugging, verifica que:

- [ ] Whapi status: Connected (verde)
- [ ] Webhook URL: `https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp`
- [ ] Webhook Method: POST
- [ ] Eventos: `messages` o `messages.post` seleccionado
- [ ] Webhook Status: Enabled
- [ ] Test Webhook: Returns 200 OK
- [ ] Endpoint funciona: `node scripts/test-webhook-endpoint.js` retorna success
- [ ] Al enviar mensaje, aparece en Webhook Logs de Whapi
- [ ] Al enviar mensaje, aparece en Runtime Logs de Vercel

**Si cumples TODO esto y aún no funciona, el problema es otro (muy raro).**

---

## 🆘 Soporte

Si después de verificar todo esto sigue sin funcionar:

1. Captura screenshot de la configuración del webhook en Whapi
2. Captura los logs de Vercel Runtime Logs (vacíos o con error)
3. Captura los Webhook Logs de Whapi (si existen)
4. Comparte estos screenshots para diagnóstico adicional
