-- ============================================
-- RLS POLICIES PARA LA TABLA `profiles`
-- ============================================
-- Este archivo contiene políticas de seguridad a nivel de fila (RLS)
-- para la tabla `profiles`. Estas políticas son un estándar de seguridad
-- y solucionan el error `net::ERR_CONNECTION_CLOSED` que ocurre cuando
-- un usuario no tiene permiso para leer su propio perfil.
-- ============================================

-- 1. Habilitar RLS en la tabla `profiles`
-- Asegúrate de que RLS está activado para la tabla.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Política de LECTURA (SELECT)
-- Permite a los usuarios leer su PROPIO perfil.
-- Esta es la política más importante para solucionar el error actual.
CREATE POLICY "Allow individual read access"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- 3. Política de ACTUALIZACIÓN (UPDATE)
-- Permite a los usuarios actualizar su PROPIO perfil.
CREATE POLICY "Allow individual update access"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Política de INSERCIÓN (INSERT) - Opcional, pero recomendada
-- Típicamente, los perfiles se crean con un trigger desde `auth.users`,
-- pero si los usuarios pueden crear su propio perfil directamente, esta política es necesaria.
-- Asume que el `id` del perfil que se está insertando coincide con el `id` del usuario autenticado.
CREATE POLICY "Allow individual insert access"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 5. Política de ELIMINACIÓN (DELETE) - Opcional y generalmente restrictiva
-- Por lo general, no se permite a los usuarios eliminar su propio perfil directamente.
-- Descomenta la siguiente línea solo si es un requisito de tu aplicación.
-- CREATE POLICY "Allow individual delete access" ON public.profiles FOR DELETE USING (auth.uid() = id);


-- ============================================
-- COMENTARIOS Y VERIFICACIÓN
-- ============================================

-- Para verificar que las políticas se han aplicado, puedes ejecutar en el editor SQL de Supabase:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

COMMENT ON POLICY "Allow individual read access" ON public.profiles IS 'Los usuarios pueden ver su propio perfil.';
COMMENT ON POLICY "Allow individual update access" ON public.profiles IS 'Los usuarios pueden actualizar su propio perfil.';
COMMENT ON POLICY "Allow individual insert access" ON public.profiles IS 'Los usuarios pueden crear su propio perfil.';

-- ============================================
-- FIN DE LAS POLÍTICAS
-- ============================================
