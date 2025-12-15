-- ================================================================
-- SCHEMA - INDEXACION V2
-- ================================================================
-- Define un esquema nuevo para la ingesta de documentos y sus chunks.
-- No reutiliza la tabla knowledge_base v1.
--
-- Requisitos:
-- - Extension: pgvector (vector)
-- - Funcion: public.is_admin() (ver supabase/fix_recursion.sql)
-- ================================================================

create extension if not exists vector;

-- Estados de ingesta
create type doc_ingest_status as enum ('pending', 'processing', 'ready', 'failed');

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Documentos originales
create table if not exists ingestion_documents (
  id uuid default gen_random_uuid() primary key,
  created_by uuid, -- auth.uid() del admin que subio
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  checksum text, -- opcional: hash del archivo para evitar duplicados
  storage_bucket text not null default 'ingestion-documents',
  storage_path text not null,

  status doc_ingest_status default 'pending',
  error_message text,
  text_chars int,
  total_chunks int default 0,
  processed_chunks int default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chunks derivados de cada documento
create table if not exists ingestion_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references ingestion_documents(id) on delete cascade not null,
  chunk_index int,
  content text not null,
  embedding vector(1024), -- ajusta dimension segun el modelo elegido
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indices iniciales
create index if not exists ingestion_chunks_doc_idx on ingestion_chunks (document_id, chunk_index);
create index if not exists ingestion_chunks_created_idx on ingestion_chunks (created_at desc);
create index if not exists ingestion_documents_status_idx on ingestion_documents (status, created_at desc);

-- Index vectorial (ajusta parametros al volumen real)
create index if not exists ingestion_chunks_embedding_idx
on ingestion_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Triggers updated_at
drop trigger if exists trg_ingestion_documents_updated on ingestion_documents;
create trigger trg_ingestion_documents_updated
  before update on ingestion_documents
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_ingestion_chunks_updated on ingestion_chunks;
create trigger trg_ingestion_chunks_updated
  before update on ingestion_chunks
  for each row execute procedure public.set_updated_at();

-- RLS (ajusta a tu modelo de seguridad)
alter table ingestion_documents enable row level security;
alter table ingestion_chunks enable row level security;

drop policy if exists "Admins manage ingestion_documents" on ingestion_documents;
create policy "Admins manage ingestion_documents"
  on ingestion_documents
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage ingestion_chunks" on ingestion_chunks;
create policy "Admins manage ingestion_chunks"
  on ingestion_chunks
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ================================================================
-- COLA: reclamar el proximo documento pendiente
-- ================================================================
-- Devuelve 0 filas si no hay nada para procesar.
create or replace function public.claim_next_ingestion_document(allow_failed boolean default false)
returns setof ingestion_documents
language plpgsql
security definer
as $$
begin
  return query
  with next_doc as (
    select id
    from ingestion_documents
    where status = 'pending'
      or (allow_failed and status = 'failed')
    order by created_at asc
    for update skip locked
    limit 1
  )
  update ingestion_documents d
  set
    status = 'processing',
    error_message = null,
    processed_chunks = 0,
    started_at = coalesce(d.started_at, now()),
    finished_at = null
  from next_doc
  where d.id = next_doc.id
  returning d.*;
end;
$$;

-- Si PostgREST no reconoce la funcion inmediatamente, fuerza recarga de schema cache:
-- NOTIFY pgrst, 'reload schema';
