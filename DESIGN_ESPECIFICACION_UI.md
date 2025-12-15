# Especificación UI/UX – TEC Rural Diagnóstico (Tech-Organic Harmony)

## 1. Sistema de Diseño "Tech-Organic Harmony"

### Paleta
- **Verde TEC Rural (Primario)**: Acciones de éxito, pestaña “Solución ecológica”, estados confirmados.
- **Azul Circuito (Secundario)**: Acciones relacionadas con IA (“Procesar”, “Escanear”), enlaces, estados de carga.
- **Blanco puro (#FFFFFF)**: Fondo principal.
- **Gris pálido (#F3F4F6)**: Separadores de secciones/superficies.
- **Gris oscuro (#1F2937)**: Tipografía de lectura (mejor fatiga visual).

### Iconografía
- Librería sugerida: **Lucide React** o **Heroicons Outline**.
- Trazos finos, 1.5–2 px, esquinas redondeadas, estilo “fine line”.

### Sistema de alertas calmado
- **Alta urgencia**: Fondo rosa pálido, borde lateral rojo fino, texto rojo oscuro (“Atención requerida”).
- **Media urgencia**: Fondo durazno, texto naranja tenue.
- **Baja/Sano**: Fondo verde menta suave.

## 2. Recorrido visual

### Pantalla Login/Bienvenida
- Logo destacado en la parte superior sobre fondo blanco.
- Inputs de borde sutil (línea inferior o borde completo 1px). Al foco, se ilumina en azul circuito.
- Botón “Entrar” con gradiente horizontal Verde→Azul (fusión Naturaleza+Tech).

### Dashboard (Inicio)
- Cabecera: saludo (“Hola, Juan”) + foto circular.
- **Tarjeta de acción** “Iniciar diagnóstico con IA”: rectángulo grande, borde suave, icono de cámara con “respiración” animada.
- Historial reciente tipo lista limpia: mini foto (círculo), nombre de cultivo, fecha gris claro; sin líneas divisorias pesadas.

### Cámara (Nueva consulta)
- UI mínima, fondo negro translúcido, solo marco de esquinas para encuadrar.
- Toggle GPS: pastilla flotante (gris transparente OFF, azul brillante ON).
- Botón disparo circular blanco con anillo exterior azul.

### Resultados
- Barra superior según urgencia (rosa, durazno, verde).
- Imagen capturada en recorte con esquinas redondeadas.
- Acordeones con iconos:
  - 🌿 Tratamiento ecológico (borde verde, icono hoja).
  - ⚗️ Tratamiento químico (borde gris/azul, icono matraz).
- Botón flotante PDF (icono línea fina) en esquina inferior derecha.

### Panel Admin
- Sidebar gris muy oscuro, logo resaltado.
- Zona RAG: cards claras, dropzone punteada en azul.
- Iconos de archivo (PDF/TXT) estilo “fine line”.

## 3. Recomendaciones generales
- Tipografía limpia (Inter, SF, etc.).
- Espaciado generoso, sombras suaves.
- Nada de rojos agresivos; la calma transmite profesionalidad y confianza.
