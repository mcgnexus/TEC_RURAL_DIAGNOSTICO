# Sistema de Autenticación - TEC Rural

## Descripción General

Se ha implementado un sistema completo de autenticación con Supabase que protege las rutas de la aplicación y gestiona sesiones de usuario.

## Archivos Creados

### 1. `.env.local`
**Ubicación:** Raíz del proyecto
**Contenido:**
- `VITE_SUPABASE_URL` - URL de tu base de datos Supabase
- `VITE_SUPABASE_ANON_KEY` - Clave pública para el cliente
- `VITE_SUPABASE_SERVICE_ROLE` - Clave de rol de servicio (solo backend)

⚠️ **Importante:** Este archivo está en `.gitignore` y NO debe compartirse.

### 2. `lib/supabaseClient.js`
**Utilidad:** Cliente centralizado de Supabase
**Funciones:**
- Importa credenciales desde variables de entorno
- Crea una única instancia para toda la aplicación
- Valida que las credenciales estén configuradas

**Uso:**
```javascript
import { supabase } from '@/lib/supabaseClient';
```

### 3. `lib/authService.js`
**Utilidad:** Servicio de autenticación
**Métodos disponibles:**
- `signup(email, password)` - Registrar nuevo usuario
- `login(email, password)` - Iniciar sesión
- `logout()` - Cerrar sesión
- `getSession()` - Obtener sesión actual
- `getCurrentUser()` - Obtener usuario autenticado
- `onAuthStateChange(callback)` - Suscribirse a cambios de estado
- `resetPassword(email)` - Enviar email de recuperación

**Uso:**
```javascript
import { authService } from '@/lib/authService';

// Login
const { user, error } = await authService.login('user@email.com', 'password');

// Logout
await authService.logout();
```

### 4. `pages/login.jsx`
**Utilidad:** Página de login
**Características:**
- Formulario con email y contraseña
- Opción para registrarse
- Validaciones de entrada
- Feedback de errores
- Estilos con Tailwind CSS

### 5. `pages/dashboard.jsx`
**Utilidad:** Página del dashboard (protegida)
**Características:**
- Solo accesible con sesión activa
- Muestra información del usuario
- Botón de cerrar sesión
- Enlaces a otras secciones
- Carga segura de sesión

### 6. `middleware.js`
**Utilidad:** Control de acceso en todas las rutas
**Funciona como portero:**
- ✅ Rutas protegidas: `/admin`, `/dashboard`
- ✅ Rutas públicas: `/login`, `/register`, `/`
- ✅ Redirige sin sesión a `/login`
- ✅ Redirige con sesión desde `/login` a `/dashboard`

## Instalación de Dependencias

Necesitas instalar la librería de Supabase:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

o con yarn:

```bash
yarn add @supabase/supabase-js @supabase/ssr
```

## Configuración en Next.js

### 1. Asegúrate de tener las variables de entorno correctas

En tu `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://yvepuccjiaktluxcpadk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica
```

⚠️ Las variables deben tener el prefijo `NEXT_PUBLIC_` para que Next.js las exponga.

### 2. Actualiza el cliente de Supabase

Aunque creamos uno con `VITE_`, para Next.js es mejor usar variables `NEXT_PUBLIC_`:

**Archivo: `lib/supabaseClient.js`**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Flujo de Autenticación

### 1. Usuario sin sesión intenta acceder a `/dashboard`
```
/dashboard → middleware → no hay sesión → redirige a /login
```

### 2. Usuario completa login
```
login.jsx → authService.login() → Supabase → sesión creada → redirige a /dashboard
```

### 3. Usuario con sesión accede a `/login`
```
/login → middleware → hay sesión → redirige a /dashboard
```

### 4. Usuario cierra sesión
```
dashboard.jsx → authService.logout() → sesión eliminada → redirige a /login
```

## Personalización

### Agregar más rutas protegidas

En `middleware.js`, línea 8:
```javascript
const protectedRoutes = ['/admin', '/dashboard', '/tu-nueva-ruta'];
```

### Cambiar validaciones de login

En `pages/login.jsx`, busca la función `handleLogin` y agrega tus validaciones.

### Personalizar la página de dashboard

Edita `pages/dashboard.jsx` para agregar tu contenido específico.

## Seguridad

✅ **Lo que está protegido:**
- Las credenciales están en `.env.local` (no en Git)
- Las sesiones se manejan server-side con middleware
- Las rutas protegidas no se pueden acceder sin autenticación
- Los tokens se almacenan en cookies seguras

## Resolución de Problemas

### "Las variables de entorno no están configuradas"
- Verifica que `.env.local` existe
- Verifica los nombres de las variables
- Reinicia el servidor de desarrollo

### "No puedo acceder a `/dashboard`"
- Verifica que tienes sesión activa
- Limpia las cookies del navegador
- Intenta login de nuevo

### "El middleware no funciona"
- Asegúrate de que `middleware.js` está en la raíz
- Verifica que tienes `@supabase/ssr` instalado
- Reinicia el servidor

## Próximos Pasos

1. Crear tabla de usuarios en Supabase (si necesitas más datos)
2. Implementar recuperación de contraseña
3. Agregar autenticación con OAuth (Google, GitHub)
4. Crear página de admin (`/admin`)
5. Agregar roles y permisos

## Recursos

- [Documentación Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side-rendering)
- [Next.js Middleware](https://nextjs.org/docs/advanced-features/middleware)
