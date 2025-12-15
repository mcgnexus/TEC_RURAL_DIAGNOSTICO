-- ================================================================
-- 1. CONFIGURACION INICIAL Y EXTENSIONES
-- ================================================================

-- Habilitamos la extension 'pgvector' para futuros casos de uso (embeddings).
create extension if not exists vector;

-- Tipos de datos personalizados (ENUMS).
create type user_role as enum ('user', 'admin');
create type diagnosis_status as enum ('pending', 'validated', 'rejected');
create type diag_source as enum ('web', 'whatsapp', 'telegram');

-- ================================================================
-- 2. TABLA DE PERFILES (Usuarios)
-- ================================================================
-- Extiende auth.users con datos personales y creditos.

create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  first_name text,
  last_name text,
  location text,
  phone text,

  -- Gestion de roles y creditos
  role user_role default 'user',
  credits_remaining int default 3,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Restricciones basicas
  constraint phone_unique unique (phone),
  constraint username_length check (char_length(first_name) >= 2)
);

-- ================================================================
-- 3. TABLA DE DIAGNOSTICOS (Historial Clinico)
-- ================================================================

create table public.diagnoses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Datos de la imagen y contexto
  image_url text not null,
  cultivo_name text not null,

  -- Resultado de IA
  ai_diagnosis_md text,
  confidence_score float,

  -- Metadatos y gestion
  status diagnosis_status default 'pending',
  source diag_source default 'web',
  gps_lat float,
  gps_long float,

  -- Notas del experto
  expert_notes text,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ================================================================
-- 4. AUTOMATIZACION (Triggers)
-- ================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, credits_remaining)
  values (new.id, new.email, 'user', 3);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================================================================
-- 5. SEGURIDAD (Row Level Security - RLS)
-- ================================================================

alter table public.profiles enable row level security;
alter table public.diagnoses enable row level security;

-- --- POLITICAS PARA PERFILES ---

create policy "Users view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins update all profiles" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- --- POLITICAS PARA DIAGNOSTICOS ---

create policy "Users view own diagnoses" on public.diagnoses
  for select using (auth.uid() = user_id);

create policy "Users insert own diagnoses" on public.diagnoses
  for insert with check (auth.uid() = user_id);

create policy "Admins manage all diagnoses" on public.diagnoses
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ================================================================
-- NOTA SOBRE INDEXACION RAG
-- ================================================================
-- La tabla knowledge_base y sus politicas se han retirado para redisenar
-- el flujo de indexacion desde cero. El nuevo esquema se definira por
-- separado (consulta supabase/indexing_v2.sql) cuando el pipeline v2
-- este listo.
