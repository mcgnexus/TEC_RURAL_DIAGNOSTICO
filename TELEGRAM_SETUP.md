# 🤖 Guía de Configuración de Telegram

## Estado Actual ✅
- ✅ Código backend completamente implementado
- ✅ Interfaces web configuradas
- ✅ Base de datos lista para migraciones
- ✅ Bot Telegram creado: `@TecRuralDiagBot`
- ✅ Token agregado a `.env.local`

---

## Pasos para Activar Telegram

### Paso 1: Aplicar Migraciones SQL en Supabase

**⚠️ IMPORTANTE - Este paso es CRÍTICO**

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto: `yvepuccjiaktluxcpadk`
3. En el menú izquierdo, ve a **SQL Editor**
4. Haz clic en **"New Query"** (botón verde)
5. Copia TODO el contenido del archivo:
   ```
   supabase/apply_telegram_migrations.sql
   ```
6. Pega el contenido en el editor de Supabase
7. Haz clic en el botón **▶ Run** (verde, arriba a la derecha)
8. Espera a que termine
9. Verifica que NO haya errores en rojo

**Resultado esperado:**
```
Query executed successfully
```

Si hay errores, intenta ejecutar cada archivo por separado:
- `supabase/add_telegram_support.sql`
- `supabase/telegram_sessions.sql`
- `supabase/telegram_link_tokens.sql`
- `supabase/extend_processed_messages.sql`

---

### Paso 2: Verificar Variables de Entorno

Tu `.env.local` debe contener:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="8535599928:AAF-5PKynYihbNvTKvKOgckO6HT1AoUqxKM"
TELEGRAM_BOT_USERNAME="TecRuralDiagBot"
```

✅ **Confirmado:** Ya está agregado en `.env.local`

---

### Paso 3: Reiniciar la Aplicación

```bash
# Detener la app actual (Ctrl+C si está corriendo)
# Luego:
npm run dev
```

Espera a que compile completamente:
```
> ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

---

### Paso 4: Probar el Bot Telegram

1. Abre Telegram
2. Busca `@TecRuralDiagBot`
3. Presiona **"Iniciar"** o envía `/start`
4. Deberías ver un menú con botones:
   - 🆕 Nuevo Diagnóstico
   - 📋 Historial
   - 💳 Créditos
   - ❓ Ayuda

**Si ves el menú → ✅ ¡Bot funcionando!**

---

### Paso 5: Vincular tu Cuenta

#### Desde la Aplicación Web:

1. Ve a [http://localhost:3000](http://localhost:3000)
2. Inicia sesión en tu cuenta
3. Ve a **Dashboard → Configuración**
4. Desplázate hasta la sección **🤖 Telegram**
5. Haz clic en **"🔗 Generar token de vinculación"**
6. Copia el token (ej: `ABC123`)

#### En Telegram:

1. Abre `@TecRuralDiagBot`
2. Envía: `/link ABC123` (reemplaza con tu token)
3. ¡Listo! Tu cuenta está vinculada ✅

---

## ¿Cómo Usar?

### Opción 1: Diagnóstico Rápido (Recomendado)
1. Abre `@TecRuralDiagBot` en Telegram
2. Envía una imagen con texto:
   - Solo cultivo: `tomate`
   - Con síntomas: `café - hojas amarillas`
3. Recibe diagnóstico al instante

### Opción 2: Paso a Paso
1. Envía `/nuevo`
2. Responde con el nombre del cultivo
3. Describe los síntomas (o escribe "omitir")
4. Envía una foto
5. Recibe diagnóstico

### Opción 3: Desde la Web
1. Crea un diagnóstico en [http://localhost:3000](http://localhost:3000)
2. Si tienes Telegram vinculado y notificaciones ON
3. Recibirás automáticamente el diagnóstico en Telegram

---

## Solución de Problemas

### "Bot no responde"
- [ ] ¿Está reiniciada la aplicación? (`npm run dev`)
- [ ] ¿Está `.env.local` con el token correcto?
- [ ] ¿Aplicaste las migraciones SQL?

### "Command not found" en Telegram
- [ ] El bot podría estar descubierto recién
- [ ] Espera 5-10 segundos y intenta de nuevo
- [ ] Envía `/help` para ver comandos disponibles

### "Token inválido"
- [ ] Verifica que el token en `.env.local` sea el correcto
- [ ] Cópialo exactamente de BotFather (sin espacios)
- [ ] Reinicia la aplicación: `npm run dev`

### "Cuenta no vinculada"
- [ ] Ve a Dashboard → Configuración
- [ ] Genera un nuevo token
- [ ] En Telegram, envía `/link TOKEN_AQUI`

### "No recibo notificaciones"
- [ ] [ ] Verifica que tu cuenta esté vinculada
- [ ] [ ] En Configuración, activa el toggle de "Notificaciones en Telegram"
- [ ] [ ] Crea un nuevo diagnóstico en la web

---

## Comandos Disponibles

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/start` | Menú principal | /start |
| `/nuevo` | Diagnóstico paso a paso | /nuevo |
| `/historial` | Últimos 5 diagnósticos | /historial |
| `/creditos` | Ver créditos disponibles | /creditos |
| `/ayuda` | Mostrar ayuda | /ayuda |
| `/link TOKEN` | Vincular cuenta | /link ABC123 |

---

## Variables de Entorno

```env
# Telegram
TELEGRAM_BOT_TOKEN=tu_token_del_bot
TELEGRAM_BOT_USERNAME=TecRuralDiagBot

# WhatsApp (ya configurado)
WHAPI_TOKEN=...
WHAPI_API_URL=...
```

---

## Base de Datos Creada

### Tablas nuevas:
- `telegram_sessions` - Sesiones conversacionales
- `telegram_link_tokens` - Tokens de vinculación

### Columnas nuevas en `profiles`:
- `telegram_id` - ID de usuario en Telegram
- `telegram_username` - Username de Telegram
- `notify_telegram_on_diagnosis` - Control de notificaciones

### Tablas modificadas:
- `processed_webhook_messages` - Ahora soporta Telegram

---

## Archivos de Configuración

**SQL:**
- `supabase/apply_telegram_migrations.sql` - Script completo
- `supabase/add_telegram_support.sql` - Columnas en profiles
- `supabase/telegram_sessions.sql` - Tabla de sesiones
- `supabase/telegram_link_tokens.sql` - Tabla de tokens
- `supabase/extend_processed_messages.sql` - Deduplicación

**Backend:**
- `app/api/telegram/generate-link-token/route.js` - API de vinculación
- `app/api/webhooks/telegram/route.js` - Webhook del bot

**Frontend:**
- `app/(dashboard)/dashboard/configuracion/page.js` - Interfaz Telegram

---

## 🎉 ¡Listo!

Si seguiste todos los pasos, Telegram debe estar completamente funcional.

### Verificación final:
1. ✅ Migraciones SQL aplicadas
2. ✅ `.env.local` con credenciales
3. ✅ Aplicación reiniciada
4. ✅ Bot responde en Telegram
5. ✅ Cuenta vinculada en la web

---

**¿Necesitas ayuda?** Revisa la sección de "Solución de Problemas" arriba.

**Última actualización:** 2025-12-18
