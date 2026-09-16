-- ============ MIGRACIÓN 010: documentos (Fase 5) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 009.
--
-- Antes de aplicar esta migración, crear a mano el bucket privado
-- "documentos" desde el dashboard de Supabase (Storage → New bucket):
--   - Public: NO.
--   - File size limit: 10 MB.
--   - Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf.
-- Esas dos últimas son una barrera a nivel plataforma, independiente de
-- que el código valide bien — no se pueden fijar por SQL, solo desde el
-- dashboard o la Management API.
--
-- Decisión central del módulo: los archivos no viven en el schema
-- `hogar`, sino en `storage.objects` (esquema propio de Supabase Storage,
-- con su propio RLS). Sin las políticas de más abajo sobre
-- `storage.objects`, un bucket privado no aísla nada entre familias: las
-- políticas de la tabla `documents` no cubren el acceso a los archivos en
-- sí, son dos sistemas de permisos separados.

set search_path = hogar;

create table hogar.document_categories (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references hogar.families(id) on delete cascade,
  name       text not null,
  kind       text not null default 'general'
               check (kind in ('personal','medico','vehiculo','hogar','educacion','general')),
  icon       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (family_id, name)
);

create table hogar.documents (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references hogar.families(id) on delete cascade,
  category_id         uuid references hogar.document_categories(id) on delete set null,
  member_id           uuid references hogar.family_members(id) on delete set null,
  title               text not null,
  doc_type            text,          -- ci | pasaporte | seguro_medico | estudio | receta | reposo | factura | manual | otro
  issued_at           date,
  expires_at          date,
  expiry_lead_days    int not null default 60,
  expiry_notified_at  timestamptz,
  tags                text[],
  notes               text,
  is_pinned           boolean not null default false,
  uploaded_by         uuid references hogar.family_members(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on hogar.documents (family_id, created_at desc);
create index on hogar.documents (family_id, expires_at) where expires_at is not null;
create index on hogar.documents using gin (tags);

create trigger documents_set_updated_at
  before update on hogar.documents
  for each row execute function hogar.set_updated_at();

-- Un documento puede tener varios archivos (frente y dorso, páginas de un
-- estudio) — ver la nota "document_files separada" en CLAUDE.md, Fase 5.
create table hogar.document_files (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references hogar.documents(id) on delete cascade,
  family_id    uuid not null references hogar.families(id) on delete cascade,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index on hogar.document_files (document_id);

-- La FK que quedó pendiente desde la migración 008 (assets.document_id ya
-- existía como columna suelta, comentada "la FK recién en Fase 5").
alter table hogar.assets
  add constraint assets_document_id_fkey
  foreign key (document_id) references hogar.documents(id) on delete set null;

-- ============ Políticas RLS (tablas de hogar) ============
-- Mismo patrón que el resto del proyecto: una sola condición por
-- política, sin lógica de roles.

alter table hogar.document_categories enable row level security;

create policy "document_categories_select" on hogar.document_categories
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "document_categories_insert" on hogar.document_categories
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "document_categories_update" on hogar.document_categories
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "document_categories_delete" on hogar.document_categories
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.documents enable row level security;

create policy "documents_select" on hogar.documents
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "documents_insert" on hogar.documents
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "documents_update" on hogar.documents
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "documents_delete" on hogar.documents
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.document_files enable row level security;

create policy "document_files_select" on hogar.document_files
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "document_files_insert" on hogar.document_files
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "document_files_update" on hogar.document_files
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "document_files_delete" on hogar.document_files
  for delete to authenticated
  using (family_id = hogar.current_family_id());

-- ============ Grants (tablas de hogar) ============
-- Las migraciones 005 y 007 ya dejaron ALTER DEFAULT PRIVILEGES para
-- authenticated y service_role respectivamente, pero se otorgan
-- explícitos igual (ver reglas 10 y 12 de CLAUDE.md). El cron diario
-- (service_role) solo necesita leer/escribir `documents` para el aviso
-- de vencimiento — no toca `document_files` ni Storage.

grant select, insert, update, delete on hogar.document_categories to authenticated;
grant select, insert, update, delete on hogar.documents to authenticated;
grant select, insert, update, delete on hogar.document_files to authenticated;

grant select, update on hogar.documents to service_role;

-- ============ Políticas sobre storage.objects ============
-- Este es el punto nuevo del proyecto: Supabase Storage guarda los
-- objetos del bucket en `storage.objects`, con su propio RLS,
-- independiente del schema `hogar`. La ruta de cada archivo es
-- `{family_id}/{document_id}/{nombre_archivo}` — el primer segmento no es
-- decorativo, es lo que permite escribir estas políticas comparando
-- contra `hogar.current_family_id()`, que ya tiene los grants necesarios
-- desde la migración 004.
--
-- Se generan URLs firmadas con el cliente de sesión (nunca el admin
-- client) precisamente para que estas políticas se apliquen solas — ver
-- CLAUDE.md, Fase 5.

create policy "documentos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = hogar.current_family_id()::text
  );

create policy "documentos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = hogar.current_family_id()::text
  );

create policy "documentos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = hogar.current_family_id()::text
  )
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = hogar.current_family_id()::text
  );

create policy "documentos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = hogar.current_family_id()::text
  );

-- ============ Seed de categorías ============
-- Igual que las categorías de compras (supabase/seed/categorias.sql), se
-- deja como script aparte porque necesita el family_id real — ver
-- supabase/seed/documentos.sql.
