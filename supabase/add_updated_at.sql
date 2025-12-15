-- ================================================================
-- MIGRACIÓN: AGREGAR UPDATED_AT A PROFILES
-- ================================================================

-- 1. Agregar la columna updated_at
alter table public.profiles 
add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- 2. Crear (o reemplazar) la función que actualiza el timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 3. Crear el trigger para que se actualice automáticamente
drop trigger if exists update_profiles_updated_at on public.profiles;

create trigger update_profiles_updated_at
before update on public.profiles
for each row
execute function update_updated_at_column();
