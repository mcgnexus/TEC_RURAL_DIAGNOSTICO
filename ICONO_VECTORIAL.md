# Icono TEC Rural - Versión Vectorial

## Descripción

El icono de TEC Rural está disponible en formato SVG (Scalable Vector Graphics) para mejor escalabilidad y rendimiento. El icono representa:

- **Planta/hojas**: Símbolo del diagnóstico agrícola
- **Punto central naranja**: Análisis e IA
- **Marco circular**: Completitud y confiabilidad del sistema

## Ubicaciones del Icono

### 1. Componente Logo (`components/Logo.jsx`)

El icono con el texto "TEC Rural" aparece en:

- ✅ **Sidebar del Dashboard**: Logo pequeño (24px) alineado a la izquierda
- ✅ **Dashboard principal**: Logo mediano (32px) centrado
- ✅ **Página de autenticación**: Logo grande (48px) centrado

El icono se redimensiona automáticamente según la prop `size`:
```jsx
<Logo size="sm" />   // 24px
<Logo size="md" />   // 32px (defecto)
<Logo size="lg" />   // 48px
```

### 2. Componente IconoTecRural (`components/IconoTecRural.jsx`)

Para usar **solo el icono** sin el texto, utiliza el componente `IconoTecRural`:

```jsx
import IconoTecRural from '@/components/IconoTecRural';

// Uso básico
<IconoTecRural size="md" />

// Con tamaños disponibles
<IconoTecRural size="xs" />   // 16px
<IconoTecRural size="sm" />   // 24px
<IconoTecRural size="md" />   // 32px (defecto)
<IconoTecRural size="lg" />   // 48px
<IconoTecRural size="xl" />   // 64px

// Con estilos personalizados
<IconoTecRural size="lg" style={{ opacity: 0.8 }} className="my-custom-class" />
```

### 3. Archivo SVG Standalone

**Ubicación**: `/public/TecRural_icono.svg`

Puedes referenciar este archivo SVG directamente:

```jsx
import Image from 'next/image';

// Método 1: Usando Image (Next.js) - Recomendado
<Image src="/TecRural_icono.svg" alt="TEC Rural" width={64} height={64} />

// Método 2: Usando img HTML
<img src="/TecRural_icono.svg" alt="TEC Rural" width="64" height="64" />

// Método 3: En CSS como background
<div style={{ backgroundImage: 'url(/TecRural_icono.svg)' }} />
```

## Integración en Otros Lugares

### Para agregar el icono en nuevos componentes:

#### Opción 1: Usar el componente Logo (con texto)

```jsx
import Logo from '@/components/Logo';

// En tu componente
<Logo size="md" />  // Muestra logo con icono y texto
<Logo size="lg" withTagline />  // Con tagline
```

#### Opción 2: Usar el componente IconoTecRural (solo icono)

```jsx
import IconoTecRural from '@/components/IconoTecRural';

// En tu componente
<IconoTecRural size="md" />
<IconoTecRural size="lg" style={{ opacity: 0.8 }} />
```

#### Opción 3: Usar el archivo SVG directamente

```jsx
import Image from 'next/image';

export default function MiComponente() {
  return (
    <Image
      src="/TecRural_icono.svg"
      alt="Icono TEC Rural"
      width={64}
      height={64}
    />
  );
}
```

## Favicon

Para usar el icono como favicon, agrega a `app/layout.js`:

```jsx
export const metadata = {
  icons: {
    icon: '/TecRural_icono.svg',
    apple: '/TecRural_icono.svg',
  },
};
```

## Colores Utilizados

El icono utiliza la paleta de colores de TEC Rural:

- **Verde principal**: `#2d9d5c` - Hojas y tallo
- **Naranja**: `#ff6b35` - Punto de análisis/IA
- **Naranja claro**: `#ff9f43` - Acento del punto central
- **Verde fondo**: `#1f8449` - Fondo sutil

## Ventajas del Formato SVG

✅ **Escalable sin pérdida**: Se adapta a cualquier tamaño sin pixelación
✅ **Menor peso**: Archivo más ligero que PNG (reducción de ~98%)
✅ **Editable**: Pueden modificarse colores y elementos fácilmente
✅ **Responsivo**: Se adapta automáticamente a cualquier pantalla
✅ **Accesible**: Soporta animaciones CSS y atributos ARIA

## Ubicaciones Donde Aparece Actualmente

1. ✅ **Sidebar del Dashboard**: Logo con icono (tamaño 24px)
2. ✅ **Dashboard Principal**: Logo con icono (tamaño 32px)
3. ✅ **Página de Autenticación**: Logo con icono (tamaño 48px)

## Componentes Disponibles

### `components/Logo.jsx`
- Muestra el icono + texto "TEC Rural"
- Tamaños: `sm` (24px), `md` (32px), `lg` (48px)
- Props opcionales: `withTagline`, `align`

### `components/IconoTecRural.jsx`
- Solo el icono, sin texto
- Tamaños: `xs` (16px), `sm` (24px), `md` (32px), `lg` (48px), `xl` (64px)
- Props opcionales: `className`, `style`

## Próximos Pasos (Opcionales)

- [ ] Agregar favicon del icono a navegadores (`app/layout.js`)
- [ ] Usar el icono en botones de acción principales
- [ ] Crear variantes del icono para diferentes estados
- [ ] Agregar animación SVG (rotación, pulsación, etc.)
- [ ] Implementar el icono en notificaciones de WhatsApp
- [ ] Usar el icono como marcador de carga/procesamiento
