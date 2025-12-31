# Guía de Instalación - Sistema RAG

> AVISO: El indexador RAG v1 se retiro; esta guia se actualizara con el nuevo flujo de indexacion.
## Paso 1: Instalar Dependencias

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
npm install @supabase/supabase-js @supabase/ssr pdf-parse mammoth
```

**O si usas yarn:**
```bash
yarn add @supabase/supabase-js @supabase/ssr pdf-parse mammoth
```

---

## Paso 2: Obtener API Key de Mistral AI

1. Ve a https://console.mistral.ai/
2. Crea una cuenta o inicia sesión
3. Ve a la sección "API Keys"
4. Haz clic en "Create new key"
5. Copia la API key generada

---

## Paso 3: Configurar Variables de Entorno

Abre el archivo `.env.local` y reemplaza:

```env
MISTRAL_API_KEY=tu_api_key_aqui
GEMINI_API_KEY=tu_gemini_api_key
GEMINI_MODEL=gemini-3-flash-preview
```

Con tu API key real:

```env
MISTRAL_API_KEY=abc123xyz789...
GEMINI_API_KEY=abc123gemini...
GEMINI_MODEL=gemini-3-flash-preview
```

---

## Paso 4: Configurar Supabase

### 4.1 Habilitar la extensión pgvector

1. Ve a tu [Dashboard de Supabase](https://app.supabase.com/)
2. Selecciona tu proyecto
3. Ve a **Database** → **Extensions**
4. Busca "vector"
5. Habilita la extensión

### 4.2 Ejecutar el Schema SQL

1. En Supabase, ve a **SQL Editor**
2. Crea una nueva query
3. Abre el archivo `supabase/schema.sql` de este proyecto
4. Copia TODO el contenido
5. Pégalo en el SQL Editor
6. Haz clic en **Run**

**Verifica que todo funcionó:**
- Ve a **Database** → **Tables**
- (retirada) La tabla `knowledge_base` se eliminará en el nuevo esquema
- Ve a **Database** → **Functions**
- (en revisión) Las funciones de búsqueda se redefinirán

---

## Paso 5: Verificar la Instalacion

> En revision: el indexador RAG v1 fue retirado y esta prueba se definira en el nuevo flujo de indexacion.


## Paso 6: Verificar en Supabase (obsoleto)

> La revisión de registros en `knowledge_base` ya no aplica porque la tabla fue retirada. Se documentará el nuevo chequeo cuando el pipeline v2 esté listo.

---

## Troubleshooting

### Error: "Cannot find module 'pdf-parse'"

**Solución:**
```bash
npm install pdf-parse
```

### Error: "MISTRAL_API_KEY no está configurada"

**Solución:**
1. Verifica que agregaste la key en `.env.local`
2. Reinicia el servidor (`Ctrl+C` y luego `npm run dev`)

### Error: "Gemini API error: 404"

**Solucion:**
1. Verifica `GEMINI_MODEL` en `.env.local`
2. Reinicia el servidor (`Ctrl+C` y luego `npm run dev`)

### Error: "función match_knowledge no existe"

**Solución:**
Ejecuta el archivo `supabase/schema.sql` en Supabase SQL Editor

### Error: "rate limit exceeded" (Mistral)

**Solución:**
- Espera unos minutos
- Mistral tiene límites de uso gratuito
- Considera actualizar tu plan en Mistral

### Error: "Vector dimension mismatch"

**Solución:**
Asegúrate de que ejecutaste correctamente el schema SQL que define `vector(1024)`

---

## Siguientes Pasos

Una vez que todo funcione:

1. ✅ Sube tus documentos reales (manuales, PDFs, etc.)
2. ✅ Verifica que se procesen correctamente
3. ⏳ Continúa con la Fase 3: Integración del Chatbot

---

## Comandos Útiles

### Ver logs del servidor
```bash
npm run dev
```

### Limpiar caché
```bash
rm -rf .next
npm run dev
```

### Verificar variables de entorno
```bash
# En tu código puedes hacer:
console.log(process.env.MISTRAL_API_KEY);
```

---

## Contacto y Soporte

Si tienes problemas:

1. Revisa los logs de la consola del navegador (F12)
2. Revisa los logs del servidor en la terminal
3. Verifica que todas las dependencias estén instaladas
4. Asegúrate de que Supabase esté configurado correctamente

**Documentación adicional:**
- [RAG_SISTEMA.md](RAG_SISTEMA.md) - Documentación completa del sistema
- [AUTENTICACION.md](AUTENTICACION.md) - Sistema de autenticación
