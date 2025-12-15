# Sistema RAG (Retrieval-Augmented Generation) - TEC Rural

> AVISO: El indexador RAG v1 se retiro; esta guia se reescribira para el nuevo flujo de indexacion.
> V2 (borrador): UI `/dashboard/admin/indexing`, API `/api/indexing/*`, schema `supabase/indexing_v2.sql`.
## Descripción General

Se ha implementado un sistema completo de RAG que permite:
1. **Subir documentos** (PDF, DOCX, TXT)
2. **Procesarlos automáticamente** (extracción, limpieza, chunking)
3. **Generar embeddings** (vectorización con Mistral AI)
4. **Almacenarlos en Supabase** (con búsqueda vectorial)
5. **Realizar búsquedas semánticas** para alimentar la IA

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FASE 2: LAVANDERÍA DE DATOS              │
└─────────────────────────────────────────────────────────────┘

Usuario Admin → Interfaz de Carga → API Procesadora → Base de Conocimiento

1. [Admin carga archivo]
        ↓
2. [Interfaz: (obsoleto) app/admin/indexador/page.jsx]
        ↓
3. [API: (obsoleto) app/api/rag/process/route.js]
        ↓
4. [Extracción de texto: lib/textExtractor.js]
        ↓
5. [Limpieza de texto]
        ↓
6. [Chunking: (obsoleto) lib/textChunker.js]
        ↓
7. [Generación de embeddings: lib/embeddingService.js]
   (Llamada a Mistral AI)
        ↓
8. [Almacenamiento: (obsoleto) lib/knowledgeBaseService.js]
   (Guardado en Supabase)
        ↓
9. [Base de datos: (retirada) knowledge_base]
```

---

## Archivos Creados

### 1. Frontend - Interfaz de Administración

#### **[(obsoleto) app/admin/indexador/page.jsx]((obsoleto) app/admin/indexador/page.jsx)**
**Utilidad:** Interfaz visual para subir documentos

**Características:**
- Drag & drop de archivos
- Validación de tipos (PDF, DOCX, TXT)
- Validación de tamaño (máx 10MB)
- Progreso de procesamiento en tiempo real
- Feedback visual de éxito/error

**Cómo llegar:**
```
[retirado] /dashboard/admin/indexador
```

---

### 2. Backend - API de Procesamiento

#### **[(obsoleto) app/api/rag/process/route.js]((obsoleto) app/api/rag/process/route.js)**
**Utilidad:** El "procesador" principal del sistema

**Flujo de procesamiento:**
1. ✅ Recibe archivo via FormData
2. ✅ Valida tipo y tamaño
3. ✅ Extrae texto del archivo
4. ✅ Limpia caracteres basura
5. ✅ Divide en chunks
6. ✅ Genera embeddings con Mistral
7. ✅ Guarda en Supabase

**Endpoint:**
```
POST /api/rag/process
Content-Type: multipart/form-data
Body: { file: <archivo> }
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "documentId": "uuid",
  "filename": "manual.pdf",
  "chunks": 45,
  "characters": 45000,
  "processedAt": "2025-01-15T10:30:00Z"
}
```

---

### 3. Servicios - Librerías de Utilidad

#### **[lib/textExtractor.js](lib/textExtractor.js)**
**Utilidad:** Extrae texto de diferentes formatos

**Funciones:**
- `extractTextFromPDF()` - Extrae texto de PDFs
- `extractTextFromDOCX()` - Extrae texto de Word
- `extractTextFromTXT()` - Lee archivos de texto
- `extractText()` - Función universal por MIME type
- `cleanText()` - Limpia caracteres no deseados

**Dependencias necesarias:**
```bash
npm install pdf-parse mammoth
```

---

#### **[(obsoleto) lib/textChunker.js]((obsoleto) lib/textChunker.js)**
**Utilidad:** Divide texto en fragmentos manejables

**Características:**
- Chunking inteligente (respeta párrafos y oraciones)
- Overlapping configurable (mantiene contexto)
- Detección de secciones
- Metadatos por chunk

**Configuración por defecto:**
```javascript
{
  chunkSize: 1000,        // Caracteres por chunk
  chunkOverlap: 200,      // Solapamiento entre chunks
  separators: ['\n\n', '\n', '. ']  // Prioridad de separadores
}
```

**Funciones principales:**
- `chunkText()` - División básica
- `chunkBySection()` - División por secciones
- `chunkTextWithMetadata()` - Con metadatos
- `estimateChunks()` - Estimar cantidad

---

#### **[lib/embeddingService.js](lib/embeddingService.js)**
**Utilidad:** Genera vectores con Mistral AI

**Características:**
- Integración con Mistral API
- Procesamiento en batch
- Rate limiting automático
- Validación de vectores

**Funciones:**
- `generateEmbedding(text)` - Un texto
- `generateEmbeddingsBatch(texts, batchSize)` - Múltiples textos
- `cosineSimilarity(vecA, vecB)` - Calcular similitud
- `isValidEmbedding(embedding)` - Validar vector

**Modelo usado:**
- `mistral-embed` - Genera vectores de 1024 dimensiones

---

#### **[(obsoleto) lib/knowledgeBaseService.js]((obsoleto) lib/knowledgeBaseService.js)**
**Utilidad:** Interactúa con Supabase

**Funciones CRUD:**
- `saveChunk()` - Guardar un chunk
- `saveChunksBatch()` - Guardar múltiples
- `searchSimilarChunks()` - Búsqueda vectorial
- `getChunksByDocument()` - Obtener por documento
- `deleteChunksByDocument()` - Eliminar documento
- `getKnowledgeBaseStats()` - Estadísticas

**Búsqueda semántica:**
```javascript
const { data } = await searchSimilarChunks(
  queryEmbedding,
  limit = 5,
  threshold = 0.7
);
```

---

### 4. Base de Datos - Schema SQL

#### **[supabase/schema.sql](supabase/schema.sql)**
**Utilidad:** Definición de la tabla y funciones

**Tabla principal:**
```sql
-- OBSOLETO: knowledge_base v1 retirada
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1024),
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Índices creados:**
- ✅ HNSW para búsqueda vectorial (rápida)
- ✅ GIN para búsqueda de texto completo
- ✅ GIN para búsqueda en JSONB metadata

**Funciones SQL:**
- `match_knowledge()` - Búsqueda vectorial
- `search_knowledge_text()` - Búsqueda por texto
- `get_knowledge_stats()` - Estadísticas

---

## Instalación y Configuración

### 1. Instalar Dependencias

```bash
npm install @supabase/supabase-js @supabase/ssr pdf-parse mammoth
```

### 2. Configurar Variables de Entorno

Añade a tu [.env.local](.env.local):

```env
# Supabase (ya configurado)
NEXT_PUBLIC_SUPABASE_URL=https://yvepuccjiaktluxcpadk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica

# Mistral AI (NUEVO - debes obtenerlo)
MISTRAL_API_KEY=tu_api_key_de_mistral
```

**Obtener API Key de Mistral:**
1. Ir a https://console.mistral.ai/
2. Registrarse/Iniciar sesión
3. Ir a API Keys
4. Crear nueva key

### 3. Configurar Supabase

#### A. Ejecutar el Schema SQL

1. Ir a Supabase Dashboard
2. Ir a SQL Editor
3. Copiar el contenido de `supabase/schema.sql`
4. Ejecutar

#### B. Habilitar pgvector

Si no está habilitado:
1. Ir a Database → Extensions
2. Buscar "vector"
3. Habilitar la extensión

---

## Flujo de Uso

### Para el Administrador

1. **(Obsoleto) Acceder al indexador**
   ```
   [retirado] /dashboard/admin/indexador
   ```

2. **Subir documentos**
   - Arrastrar archivos o hacer clic
   - Seleccionar PDF, DOCX o TXT
   - Click en "Procesar e Indexar"

3. **Ver progreso**
   - Cada archivo muestra su estado
   - ✓ Éxito: Muestra cantidad de chunks
   - ✗ Error: Muestra mensaje de error

### Para el Sistema (Backend)

El procesamiento ocurre automáticamente:

```
Archivo → Extracción → Limpieza → Chunking → Embeddings → Supabase
```

**Ejemplo de chunk guardado:**
```json
{
  "id": "uuid",
  "content": "El maíz es un cultivo fundamental...",
  "embedding": [0.123, -0.456, 0.789, ...],  // 1024 números
  "metadata": {
    "documentId": "uuid",
    "filename": "manual_maiz.pdf",
    "fileType": "application/pdf",
    "chunkIndex": 0,
    "totalChunks": 45
  }
}
```

---

## Búsqueda Semántica (Próxima Fase)

Una vez indexados los documentos, puedes buscar:

```javascript
import { generateEmbedding } from '@/lib/embeddingService';
import { searchSimilarChunks } from '@/lib/knowledgeBaseService';

// 1. Generar embedding de la pregunta del usuario
const question = "¿Cómo cultivar maíz en suelos ácidos?";
const questionEmbedding = await generateEmbedding(question);

// 2. Buscar chunks similares
const { data: results } = await searchSimilarChunks(
  questionEmbedding,
  5,     // Top 5 resultados
  0.7    // Umbral de similitud (70%)
);

// 3. Resultados contienen el contexto relevante
results.forEach(result => {
  console.log(`Similitud: ${result.similarity}`);
  console.log(`Contenido: ${result.content}`);
  console.log(`Documento: ${result.metadata.filename}`);
});
```

---

## Estructura de Archivos

```
TEC_RURAL_DIAGNOSTICO/
│
├── app/
│   ├── admin/
│   │   └── (obsoleto) indexador/
│   │       └── page.jsx           ← Interfaz de carga
│   └── api/
│       └── rag/
│           └── process/
│               └── route.js       ← API procesadora
│
├── lib/
│   ├── supabaseClient.js         ← Cliente Supabase
│   ├── textExtractor.js          ← Extracción de texto
│   ├── textChunker.js            ← Sistema de chunking
│   ├── embeddingService.js       ← Generación de embeddings
│   └── knowledgeBaseService.js   ← Gestión de BD
│
├── supabase/
│   └── schema.sql                ← Schema de BD
│
├── .env.local                     ← Variables de entorno
└── RAG_SISTEMA.md                ← Esta documentación
```

---

## Resolución de Problemas

### Error: "MISTRAL_API_KEY no está configurada"
**Solución:** Agregar la key a `.env.local` y reiniciar el servidor

### Error: "función match_knowledge no existe"
**Solución:** Ejecutar el script `supabase/schema.sql` en Supabase

### Error: "pdf-parse no encontrado"
**Solución:** Instalar dependencias:
```bash
npm install pdf-parse mammoth
```

### Error: "Rate limit exceeded" de Mistral
**Solución:** El servicio ya maneja rate limiting, pero puedes:
- Reducir `batchSize` en el código
- Esperar un momento antes de procesar más archivos

### Error: "Vector dimension mismatch"
**Solución:** Asegúrate de que la tabla use `vector(1024)` no otra dimensión

---

## Optimizaciones

### Para archivos grandes:
- Aumentar timeout del API route
- Procesar en chunks más pequeños
- Implementar queue system

### Para mejor precisión:
- Ajustar `chunkSize` y `chunkOverlap`
- Usar preprocesamiento más sofisticado
- Ajustar threshold de similitud

### Para rendimiento:
- Usar batch processing
- Implementar caché de embeddings
- Usar índices HNSW (ya implementado)

---

## Próximos Pasos

1. ✅ Sistema RAG implementado
2. ⏳ Integrar con chatbot (Fase 3)
3. ⏳ Implementar búsqueda híbrida (vectorial + texto)
4. ⏳ Agregar filtros por metadata
5. ⏳ Crear interfaz de gestión de documentos
6. ⏳ Implementar analytics de uso

---

## Referencias

- [Mistral AI Documentation](https://docs.mistral.ai/)
- [Supabase Vector Search](https://supabase.com/docs/guides/ai/vector-search)
- [pgvector](https://github.com/pgvector/pgvector)
- [RAG Pattern](https://python.langchain.com/docs/use_cases/question_answering/)
