# 🌾 TEC Rural - Sistema de Diagnóstico Agrícola con IA

Sistema inteligente de diagnóstico agrícola que utiliza RAG (Retrieval-Augmented Generation) para proporcionar información basada en documentos técnicos y manuales especializados.
> AVISO: El indexador RAG v1 (/dashboard/admin/indexador y /api/rag/process) se retiro. El flujo de indexacion se esta redisenando; ignora las instrucciones antiguas de indexado.

---

## 📋 Descripción

**TEC Rural** es una plataforma que combina:
- 🔐 **Autenticación de usuarios** con Supabase
- 📚 **Indexación de documentos** (PDF, DOCX, TXT)
- 🤖 **Inteligencia Artificial** con embeddings de Mistral AI
- 🔍 **Búsqueda semántica** usando vectores pgvector
- 💬 **Chatbot inteligente** (próximamente)

---

## 🚀 Estado del Proyecto

```
✅ FASE 1: Sistema de Autenticación (100%)
✅ FASE 2: Lavandería de Datos - RAG (100%)
⏳ FASE 3: Chatbot con IA (0%)
⏳ FASE 4: Diagnóstico Agrícola (0%)
```

**Progreso general:** 50% completo

---

## 🛠️ Tecnologías

| Categoría | Tecnología |
|-----------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Next.js API Routes |
| Base de Datos | Supabase (PostgreSQL + pgvector) |
| Autenticación | Supabase Auth |
| IA - Embeddings | Mistral AI (mistral-embed) |
| IA - Diagnostico | Gemini (gemini-3-flash-preview) |
| Extracción de Texto | pdf-parse, mammoth |
| Búsqueda Vectorial | pgvector (HNSW) |

---

## 📁 Estructura del Proyecto

TEC_RURAL_DIAGNOSTICO/
? app/                 # Rutas Next.js (auth, dashboard, api)
? components/          # UI compartida
? lib/                 # Servicios (auth, embedding, diagnosis, etc.)
? supabase/            # SQL auxiliar (RLS, fixes)
? TEC_RURAL.sql        # Schema principal sin knowledge_base (v2 pendiente)
? package.json
? README.md

---

## 🎯 Características Implementadas

### ✅ Fase 1: Autenticación
- Registro de usuarios
- Login/Logout
- Protección de rutas con middleware
- Dashboard personalizado
- Gestión de sesiones con Supabase

### ✅ Fase 2: Sistema RAG (en redisenyo; indexador v1 retirado)
- Carga de documentos (PDF, DOCX, TXT)
- Extracción automática de texto
- Limpieza y normalización de texto
- Chunking inteligente con overlap
- Generación de embeddings (1024 dimensiones)
- Almacenamiento vectorial en Supabase
- Índices optimizados para búsqueda rápida

---

## Borrador Indexacion v2

- UI: `/dashboard/admin/indexing` (`app/(dashboard)/dashboard/admin/indexing/page.js`)
- API:
  - `POST /api/indexing/upload` (`app/api/indexing/upload/route.js`)
  - `POST /api/indexing/process` (`app/api/indexing/process/route.js`)
  - `POST /api/indexing/process-next` (`app/api/indexing/process-next/route.js`)
  - `GET /api/indexing/documents` (`app/api/indexing/documents/route.js`)
  - `DELETE /api/indexing/documents/:id` (`app/api/indexing/documents/[id]/route.js`)
- Schema: `supabase/indexing_v2.sql` (tablas `ingestion_documents` y `ingestion_chunks`)
- Requisitos:
  - Crear bucket de Storage `ingestion-documents` (o configurar `SUPABASE_INGESTION_BUCKET`)
  - Aplicar `supabase/fix_recursion.sql` (incluye `public.is_admin()`)
  - Aplicar `supabase/indexing_v2.sql`
- Uso:
  - Entra a `/dashboard/admin/indexing`, sube archivos y pulsa “Procesar siguiente” para ver el progreso por chunks.

## 📦 Instalación

### Pre-requisitos

- Node.js v18 o superior
- Cuenta de [Supabase](https://supabase.com/)
- Cuenta de [Mistral AI](https://console.mistral.ai/)
- Cuenta de [Google AI Studio](https://aistudio.google.com/) (Gemini)

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd TEC_RURAL_DIAGNOSTICO
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env.local` con:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key

# Mistral AI
MISTRAL_API_KEY=tu_mistral_api_key

# Gemini
GEMINI_API_KEY=tu_gemini_api_key
GEMINI_MODEL=gemini-3-flash-preview
```

### 4. Configurar Supabase

1. Ve a tu Dashboard de Supabase
2. Habilita la extensión **pgvector**:
   - Database → Extensions → Buscar "vector" → Habilitar

3. Ejecuta el schema SQL:
   - SQL Editor → Nueva query
   - Copia el contenido de `supabase/schema.sql`
   - Ejecutar

### 5. Iniciar el servidor

```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:3000`

---

## 🎓 Uso del Sistema

### 1. Crear una cuenta

1. Ir a `http://localhost:3000/login`
2. Hacer clic en "Crear cuenta"
3. Ingresar email y contraseña
4. Iniciar sesión

### 2. Acceder al Dashboard

Después del login, serás redirigido al dashboard donde verás:
- Información de tu cuenta
- Enlace al Indexador de Documentos
- Enlaces a otras secciones

### 3. Indexar Documentos (obsoleto)

> El indexador RAG v1 se retiro. El flujo v2 se documentara aqui cuando este listo.

### 4. Verificar en Supabase (obsoleto)

> La tabla knowledge_base fue retirada mientras se define el nuevo esquema de indexacion.

---

## 📚 Documentación

| Archivo | Descripción |
|---------|-------------|
| [README.md](README.md) | Este archivo - Introducción general |
| [AUTENTICACION.md](AUTENTICACION.md) | Sistema de autenticación completo |
| [RAG_SISTEMA.md](RAG_SISTEMA.md) | Documentación técnica del RAG |
| [INSTALACION_RAG.md](INSTALACION_RAG.md) | Guía paso a paso de instalación |
| [RESUMEN_FASE2.md](RESUMEN_FASE2.md) | Resumen de la Fase 2 |
| [CHECKLIST_FASE2.md](CHECKLIST_FASE2.md) | Checklist de verificación |

---

## 🔧 Configuración Avanzada

### Ajustar el tamaño de chunks

En `lib/textChunker.js`:

```javascript
const DEFAULT_CONFIG = {
  chunkSize: 1000,      // Ajustar según necesidad
  chunkOverlap: 200,    // Solapamiento entre chunks
};
```

### Cambiar el modelo de embeddings

En `lib/embeddingService.js`:

```javascript
model: 'mistral-embed',  // Cambiar a otro modelo si lo deseas
```

### Configurar el modelo de Gemini

En `.env.local`:

```env
GEMINI_MODEL=gemini-3-flash-preview
```

### Configurar límites de archivo

En `app/api/rag/process/route.js`:

```javascript
const maxSize = 10 * 1024 * 1024; // 10MB - ajustar según necesidad
```

---

## 🔍 Búsqueda Semántica (Próximamente)

El sistema permitirá realizar búsquedas como:

```javascript
// Ejemplo de búsqueda
const question = "¿Cómo cultivar maíz en suelos ácidos?";
const results = await searchKnowledge(question);

// Resultados incluyen:
// - Texto relevante
// - Documento de origen
// - Score de similitud
```

---

## 🧪 Testing

### Probar con archivo de ejemplo

Crea `test.txt`:
```
El maíz es un cultivo fundamental en la agricultura.
Requiere suelos bien drenados y temperaturas cálidas.
El riego debe ser constante durante el crecimiento.
```

Sube el archivo y verifica que se procese correctamente.

---

## 🐛 Resolución de Problemas

### Error: "Cannot find module"
```bash
npm install
```

### Error: "MISTRAL_API_KEY no está configurada"
1. Verifica `.env.local`
2. Reinicia el servidor

### Error: "Gemini API error: 404"
1. Verifica `GEMINI_MODEL` en `.env.local`
2. Reinicia el servidor

### Error: "función match_knowledge no existe"
Ejecuta `supabase/schema.sql` en Supabase

Para más problemas, consulta [CHECKLIST_FASE2.md](CHECKLIST_FASE2.md)

---

## 🛣️ Roadmap

### ✅ Completado
- [x] Sistema de autenticación
- [x] Middleware de protección de rutas
- [x] Indexador de documentos
- [x] Procesamiento RAG completo
- [x] Base de conocimiento vectorial

### 🔄 En Progreso
- [ ] Interfaz de chatbot
- [ ] Integración con Gemini
- [ ] Búsqueda híbrida (vectorial + texto)

### 📋 Planeado
- [ ] Sistema de diagnóstico agrícola
- [ ] Recomendaciones personalizadas
- [ ] Analytics y reportes
- [ ] API pública
- [ ] App móvil

---

## 📄 Licencia

Este proyecto es parte de TEC Rural y está bajo desarrollo activo.

---

## 👥 Contribuir

Este es un proyecto en desarrollo. Para contribuir:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la [documentación](RAG_SISTEMA.md)
2. Consulta el [checklist](CHECKLIST_FASE2.md)
3. Abre un issue en el repositorio

---

## 🙏 Agradecimientos

- [Supabase](https://supabase.com/) - Backend y base de datos
- [Mistral AI](https://mistral.ai/) - Embeddings
- [Next.js](https://nextjs.org/) - Framework
- [Tailwind CSS](https://tailwindcss.com/) - Estilos

---

## 📊 Estadísticas del Proyecto

- **Líneas de código:** ~5,000+
- **Archivos creados:** 20+
- **Documentación:** 6 archivos
- **APIs integradas:** 2 (Supabase, Mistral)
- **Tiempo de desarrollo:** Fase 1-2 completas

---

**Hecho con ❤️ para la agricultura sostenible**

🌱 TEC Rural - Tecnología al servicio del campo
