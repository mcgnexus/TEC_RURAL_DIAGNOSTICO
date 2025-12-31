# ✅ Checklist - Fase 2: Sistema RAG

> AVISO: El indexador RAG v1 se retiro; este checklist queda en revision hasta definir el nuevo flujo de indexacion.
## Pre-requisitos

- [ ] Node.js instalado (v18 o superior)
- [ ] Cuenta de Supabase creada
- [ ] Cuenta de Mistral AI creada
- [ ] Editor de código (VS Code recomendado)

---

## 1. Instalación de Dependencias

```bash
npm install @supabase/supabase-js @supabase/ssr pdf-parse mammoth
```

**Verificar:**
- [ ] `package.json` contiene todas las dependencias
- [ ] `node_modules` fue creado
- [ ] No hay errores en la instalación

---

## 2. Configuración de Variables de Entorno

**Archivo: `.env.local`**

- [ ] `VITE_SUPABASE_URL` está configurada
- [ ] `VITE_SUPABASE_ANON_KEY` está configurada
- [ ] `NEXT_PUBLIC_SUPABASE_URL` está configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` está configurada
- [ ] `MISTRAL_API_KEY` está configurada (obtener de https://console.mistral.ai/)
- [ ] `GEMINI_API_KEY` esta configurada (si usas diagnostico)
- [ ] `GEMINI_MODEL` esta configurado (default: gemini-3-flash-preview)

**Verificar:**
```bash
# En tu código, agregar temporalmente:
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Mistral Key:', process.env.MISTRAL_API_KEY ? 'Configurada ✓' : 'NO configurada ✗');
console.log('Gemini Key:', process.env.GEMINI_API_KEY ? 'Configurada ƒo"' : 'NO configurada ƒo-');
console.log('Gemini Model:', process.env.GEMINI_MODEL || 'gemini-3-flash-preview');
```

---

## 3. Configuración de Supabase

### 3.1 Habilitar pgvector

- [ ] Ir a Supabase Dashboard
- [ ] Database → Extensions
- [ ] Buscar "vector"
- [ ] Habilitar la extensión

### 3.2 Ejecutar Schema SQL

- [ ] Ir a SQL Editor en Supabase
- [ ] Abrir archivo `supabase/schema.sql`
- [ ] Copiar todo el contenido
- [ ] Pegar en SQL Editor
- [ ] Ejecutar (Run)
- [ ] Verificar que no hay errores

### 3.3 Verificar Tabla Creada (obsoleto)

- [ ] La tabla `knowledge_base` fue retirada; las nuevas tablas se definirán en el pipeline v2.

### 3.4 Verificar Funciones (obsoleto)

- [ ] Las funciones `match_knowledge` y `search_knowledge_text` se rediseñarán; no se validan en esta versión.

---

## 4. Estructura de Archivos

Verificar que existen:

### Frontend (obsoleto)
- [ ] (retirado) `app/admin/indexador/page.jsx`

### Backend (obsoleto)
- [ ] (retirado) `app/api/rag/process/route.js`

### Servicios
- [ ] `lib/supabaseClient.js`
- [ ] `lib/textExtractor.js`
- [ ] `lib/textChunker.js`
- [ ] `lib/embeddingService.js`
- [ ] `lib/knowledgeBaseService.js`

### Autenticación (Fase 1)
- [ ] `lib/authService.js`
- [ ] `pages/login.jsx`
- [ ] `pages/dashboard.jsx`
- [ ] `middleware.js`

### Base de Datos
- [ ] `supabase/schema.sql`

### Configuración
- [ ] `.env.local`
- [ ] `.gitignore`

### Documentación
- [ ] `RAG_SISTEMA.md`
- [ ] `INSTALACION_RAG.md`
- [ ] `AUTENTICACION.md`
- [ ] `RESUMEN_FASE2.md`
- [ ] `CHECKLIST_FASE2.md` (este archivo)

---

## 5. Prueba del Sistema

### 5.1 Iniciar Servidor

```bash
npm run dev
```

**Verificar:**
- [ ] Servidor inicia sin errores
- [ ] Puerto: `http://localhost:3000`
- [ ] No hay errores en consola

### 5.2 Acceder a Login

```
http://localhost:3000/login
```

**Verificar:**
- [ ] Página carga correctamente
- [ ] Formulario se muestra
- [ ] Estilos de Tailwind funcionan

### 5.3 Crear Usuario

- [ ] Registrarse con email y contraseña
- [ ] Recibir confirmación
- [ ] Verificar email si es necesario
- [ ] Iniciar sesión

### 5.4 Acceder a Dashboard

```
http://localhost:3000/dashboard
```

**Verificar:**
- [ ] Dashboard carga
- [ ] Muestra información del usuario
- [ ] Botón de logout funciona

### 5.5 Acceder al Indexador

```
[retirado] /dashboard/admin/indexador
```

**Verificar:**
- [ ] Página carga
- [ ] Área de upload se muestra
- [ ] Estilos correctos

### 5.6 Probar Upload de Archivo

**Crear archivo de prueba: `test.txt`**
```
Este es un documento de prueba para el sistema RAG.
Contiene información básica sobre agricultura sostenible.
El maíz es un cultivo importante en zonas rurales.
```

**Proceso:**
- [ ] Subir archivo `test.txt`
- [ ] Ver estado "Procesando..."
- [ ] Esperar respuesta
- [ ] Ver "✓ X chunks procesados"

### 5.7 Verificar en Supabase (obsoleto)

- [ ] Las validaciones sobre `knowledge_base` ya no aplican; se documentará el checklist nuevo cuando exista la tabla v2.

---

## 6. Pruebas Adicionales

### PDF
- [ ] Subir un PDF simple
- [ ] Verificar procesamiento exitoso
- [ ] Revisar chunks en Supabase

### DOCX
- [ ] Subir un archivo Word
- [ ] Verificar procesamiento exitoso
- [ ] Revisar chunks en Supabase

### Archivos Grandes
- [ ] Intentar subir archivo >10MB
- [ ] Verificar que muestra error
- [ ] Error: "archivo demasiado grande"

### Archivos Inválidos
- [ ] Intentar subir .jpg o .png
- [ ] Verificar que muestra error
- [ ] Error: "tipo no soportado"

---

## 7. Verificación de Logs

### En la Terminal del Servidor

Deberías ver:
```
📄 Procesando archivo: test.txt (text/plain, 150 bytes)
🔍 Extrayendo texto...
✅ Texto extraído: 150 caracteres
🧹 Limpiando texto...
✅ Texto limpiado: 140 caracteres
✂️  Dividiendo en chunks...
✅ 3 chunks creados
🤖 Generando embeddings con Mistral AI...
✅ 3 embeddings generados
💾 Guardando en base de conocimiento...
✅ 3 chunks guardados exitosamente
```

**Verificar:**
- [ ] Todos los pasos se completan
- [ ] No hay errores en rojo
- [ ] Números tienen sentido

### En la Consola del Navegador (F12)

**Verificar:**
- [ ] No hay errores en rojo
- [ ] Petición POST a `/api/rag/process` exitosa (200)
- [ ] Respuesta contiene `success: true`

---

## 8. Comandos Útiles

### Reiniciar servidor
```bash
# Ctrl+C para detener
npm run dev
```

### Limpiar caché de Next.js
```bash
rm -rf .next
npm run dev
```

### Ver versión de Node
```bash
node --version
```

### Ver dependencias instaladas
```bash
npm list --depth=0
```

### Reinstalar dependencias
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 9. Resolución de Problemas

### ❌ "Cannot find module 'pdf-parse'"
```bash
npm install pdf-parse
```

### ❌ "MISTRAL_API_KEY no está configurada"
1. Verificar `.env.local`
2. Reiniciar servidor
3. Verificar que el archivo se llama exactamente `.env.local`

### ❌ "función match_knowledge no existe"
1. Ir a Supabase SQL Editor
2. Ejecutar `supabase/schema.sql`
3. Verificar que se ejecutó sin errores

### ❌ "TypeError: Cannot read property 'map'"
- Verificar que el archivo tiene contenido
- Revisar logs del servidor
- Intentar con un archivo más simple

### ❌ "Rate limit exceeded" (Mistral)
- Esperar 1-2 minutos
- Reducir cantidad de archivos
- Verificar límites del plan gratuito

### ❌ Página en blanco
1. F12 → Console → ver errores
2. Verificar que Tailwind CSS está configurado
3. Verificar imports de React

---

## 10. Checklist de Seguridad

- [ ] `.env.local` está en `.gitignore`
- [ ] No hay credenciales en el código
- [ ] API keys no están expuestas al cliente
- [ ] Validación de archivos implementada
- [ ] Límite de tamaño configurado

---

## 11. Performance

### Métricas esperadas:
- Archivo TXT (1KB): **~2-3 segundos**
- Archivo PDF (100KB): **~5-10 segundos**
- Archivo DOCX (200KB): **~10-15 segundos**

**Si es más lento:**
- Verificar conexión a internet
- Verificar plan de Mistral AI
- Reducir `batchSize` en el código

---

## 12. Documentación

- [ ] Leer [RAG_SISTEMA.md](RAG_SISTEMA.md)
- [ ] Leer [INSTALACION_RAG.md](INSTALACION_RAG.md)
- [ ] Entender el flujo del sistema
- [ ] Revisar ejemplos de código

---

## ✅ Sistema Listo

Si todos los checkboxes están marcados:

🎉 **¡Felicidades! El Sistema RAG está funcionando correctamente**

**Puedes continuar con:**
- Subir tus documentos reales
- Prepararte para la Fase 3 (Chatbot)
- Personalizar la interfaz

---

## 📊 Estadísticas Esperadas

Después de subir algunos documentos:

```bash
# En Supabase SQL Editor, ejecutar:
SELECT * FROM get_knowledge_stats();
```

**Deberías ver:**
- `total_chunks`: Número de chunks guardados
- `avg_content_length`: Promedio de caracteres por chunk
- `oldest_entry`: Primer documento procesado
- `newest_entry`: Último documento procesado

---

## 🚀 Siguiente Paso

**Cuando todo esté ✅:**

Continúa con la **Fase 3: Chatbot Inteligente**

El sistema está listo para:
- Búsquedas semánticas
- Integración con IA
- Respuestas basadas en tus documentos

---

## 📞 Recursos

- [Documentación Supabase](https://supabase.com/docs)
- [Documentación Mistral AI](https://docs.mistral.ai/)
- [Documentación pgvector](https://github.com/pgvector/pgvector)
- [Next.js Docs](https://nextjs.org/docs)
