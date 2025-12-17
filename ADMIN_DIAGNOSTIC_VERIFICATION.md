# Sistema de Verificación de Diagnósticos para Administradores

## Descripción General

Este sistema permite que los administradores tengan acceso a información adicional de cada diagnóstico para verificar y auditar el proceso de toma de decisiones del modelo de IA.

## Características para Administradores

Los usuarios con rol de `admin` pueden acceder a:

1. **Cadena de Razonamiento del LLM**: El proceso de pensamiento completo que utilizó el modelo de IA para llegar al diagnóstico
2. **Fragmentos RAG Utilizados**: Los documentos y fragmentos específicos de la base de conocimiento que se usaron para generar el diagnóstico

## Configuración Inicial

### 1. Ejecutar el Script SQL

Ejecuta el siguiente script en tu consola de Supabase para agregar el campo de razonamiento:

```sql
-- Ubicación: supabase/add_llm_reasoning.sql
```

Puedes ejecutarlo desde:
- **Supabase Dashboard** → SQL Editor → Pega el contenido del archivo y ejecuta

### 2. Asignar Rol de Administrador

Para que un usuario sea administrador, actualiza su perfil en la tabla `profiles`:

```sql
-- Cambiar rol de un usuario a admin
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'UUID_DEL_USUARIO';
```

O desde Supabase Dashboard:
1. Ve a **Table Editor** → `profiles`
2. Busca el usuario
3. Edita el campo `role` y establece el valor `admin`

### 3. Verificar Permisos

El sistema ya tiene configuradas las políticas RLS (Row Level Security) que protegen el acceso a esta información sensible. La función `is_admin()` verifica automáticamente si el usuario tiene rol de administrador.

## Cambios Implementados

### 1. Base de Datos

**Archivo**: `supabase/add_llm_reasoning.sql`
- Agrega el campo `llm_reasoning` a la tabla `diagnoses`
- Este campo almacena la respuesta completa del LLM

### 2. Motor de Diagnóstico

**Archivo**: `lib/diagnosisEngine.js` (línea 687)
- Ahora guarda el campo `llm_reasoning` con el texto completo del LLM
- El valor proviene de `geminiResult.raw_text`

### 3. Interfaz de Usuario

**Archivo**: `app/(dashboard)/dashboard/historial/page.js`

**Cambios principales**:
- Agrega estado `isAdmin` para controlar la visibilidad
- Verifica el rol del usuario al cargar los diagnósticos
- Solo solicita `llm_reasoning` de la base de datos si el usuario es admin
- Muestra condicionalmente:
  - Componente `RagUsageIndicator` (fragmentos RAG)
  - Sección "Cadena de Razonamiento del LLM"

## Seguridad

- ✅ **RLS Policies**: Las políticas de seguridad a nivel de fila protegen el acceso
- ✅ **Consultas Condicionales**: El campo `llm_reasoning` solo se solicita si el usuario es admin
- ✅ **Renderizado Condicional**: Los componentes sensibles solo se muestran a admins
- ✅ **Verificación en Cliente**: El frontend verifica el rol desde la tabla `profiles`

## Interfaz de Usuario

### Para Usuarios Normales
- Ven el diagnóstico completo
- Pueden confirmar el diagnóstico
- Pueden descargar PDF
- **NO ven** la cadena de razonamiento ni los fragmentos RAG

### Para Administradores
Todo lo anterior, más:
- **Fragmentos RAG**: Lista de documentos y fragmentos utilizados con sus scores de similitud
- **Cadena de Razonamiento**: Proceso completo de pensamiento del LLM
  - Estilo distintivo con fondo naranja claro
  - Icono 🔒 indicando que es contenido restringido
  - Texto en formato monospace para mejor legibilidad
  - Scroll si el contenido es muy largo (max-height: 400px)

## Cómo Usar (Administradores)

1. **Accede a la página de Historial**: `/dashboard/historial`
2. **Selecciona un diagnóstico**: Click en "Ver diagnóstico"
3. **Visualiza la información adicional**:
   - Scroll hacia abajo después del diagnóstico
   - Verás la sección "🔒 Cadena de Razonamiento del LLM"
   - Verás el componente "RAG Usage Indicator" con los fragmentos utilizados
4. **Revisa el razonamiento**: Lee el proceso de pensamiento del LLM
5. **Verifica los fragmentos RAG**: Confirma que los documentos utilizados son correctos
6. **Confirma el diagnóstico**: Si todo es correcto, click en "Confirmar"

## Casos de Uso

### 1. Auditoría de Calidad
Los administradores pueden revisar aleatoriamente diagnósticos para:
- Verificar que el LLM está razonando correctamente
- Confirmar que usa fragmentos RAG relevantes
- Identificar patrones de errores

### 2. Mejora del Sistema
Analizar diagnósticos incorrectos para:
- Entender por qué el LLM falló
- Identificar gaps en la base de conocimiento
- Mejorar los prompts del sistema

### 3. Validación de Diagnósticos Críticos
Para diagnósticos con:
- Baja confianza (< 60%)
- Cultivos de alto valor económico
- Enfermedades graves o cuarentenarias

## Troubleshooting

### No veo la cadena de razonamiento
- Verifica que tu usuario tiene `role = 'admin'` en la tabla `profiles`
- Actualiza la página después de cambiar el rol
- Verifica que ejecutaste el script SQL para agregar el campo `llm_reasoning`

### El campo llm_reasoning está vacío
- Solo los diagnósticos nuevos tendrán este campo poblado
- Los diagnósticos anteriores a la migración no tendrán cadena de razonamiento
- Crea un nuevo diagnóstico para probar

### Errores de permisos
- Verifica que las políticas RLS están activas
- Confirma que la función `is_admin()` existe en Supabase
- Revisa los logs de Supabase para más detalles

## Próximos Pasos

Posibles mejoras futuras:
- [ ] Sistema de anotaciones para marcar diagnósticos problemáticos
- [ ] Estadísticas de calidad para administradores
- [ ] Exportación de razonamientos para análisis offline
- [ ] Dashboard de métricas de RAG (documentos más utilizados, scores promedio, etc.)
