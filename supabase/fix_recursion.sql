-- ================================================================
-- SOLUCIÓN AL ERROR DE RECURSIÓN INFINITA
-- ================================================================

-- 1. Crear una función segura para verificar si es admin.
-- 'SECURITY DEFINER' permite que esta función se ejecute con privilegios elevados,
-- evitando que se activen las políticas RLS recursivamente al consultar la tabla profiles.

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$;

-- 2. Eliminar las políticas antiguas que causan el bucle

drop policy if exists "Admins view all profiles" on public.profiles;
drop policy if exists "Admins update all profiles" on public.profiles;
drop policy if exists "Admins manage all diagnoses" on public.diagnoses;

-- 3. Recrear las políticas usando la nueva función segura is_admin()

-- Políticas para Profiles
create policy "Admins view all profiles" on public.profiles
  for select using (
    is_admin()
  );

create policy "Admins update all profiles" on public.profiles
  for update using (
    is_admin()
  );

-- Políticas para Diagnoses
create policy "Admins manage all diagnoses" on public.diagnoses
  for all using (
    is_admin()
  );

-- Políticas para Knowledge Base
-- (La politica sobre knowledge_base se elimina; la tabla se retiró)
