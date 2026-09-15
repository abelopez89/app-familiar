-- ============ MIGRACIÓN 008: tareas del hogar (Fase 3) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 007.
--
-- Decisión central del módulo: las tareas de mantenimiento NO recurren
-- contra el calendario como los eventos (lib/recurrence.ts) — recurren
-- contra el último cumplimiento real (o contra el vencimiento teórico,
-- según recurrence_anchor). Ver lib/tasks/schedule.ts.

set search_path = hogar;

create table hogar.assets (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references hogar.families(id) on delete cascade,
  name                text not null,
  asset_type          text not null default 'electrodomestico'
                        check (asset_type in ('electrodomestico','instalacion','vehiculo','otro')),
  brand               text,
  model               text,
  location            text,
  purchased_at        date,
  warranty_until      date,
  warranty_notified_at timestamptz,
  document_id         uuid,          -- manual/factura; la FK recién en Fase 5
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
create index on hogar.assets (family_id);

-- warranty_notified_at no está en el diseño original del prompt, pero el
-- aviso de garantía necesita el mismo mecanismo de idempotencia que las
-- tareas (notified_at + reenvío cada 7 días) — sin esta columna, el cron
-- mandaría el aviso de garantía todos los días mientras esté vigente.

create table hogar.task_definitions (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references hogar.families(id) on delete cascade,
  title             text not null,
  description       text,
  asset_id          uuid references hogar.assets(id) on delete set null,
  assigned_to       uuid references hogar.family_members(id) on delete set null,
  recurrence_every  int,
  recurrence_unit   text check (recurrence_unit in ('days','weeks','months','years')),
  recurrence_anchor text not null default 'completion'
                      check (recurrence_anchor in ('completion','schedule')),
  next_due_date     date not null,
  lead_days         int not null default 2,
  notify_telegram   boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint recurrence_completa check (
    (recurrence_every is null and recurrence_unit is null)
    or (recurrence_every is not null and recurrence_unit is not null)
  )
);
create index on hogar.task_definitions (family_id, next_due_date) where is_active;

create trigger task_definitions_set_updated_at
  before update on hogar.task_definitions
  for each row execute function hogar.set_updated_at();

create table hogar.task_instances (
  id            uuid primary key default gen_random_uuid(),
  definition_id uuid not null references hogar.task_definitions(id) on delete cascade,
  family_id     uuid not null references hogar.families(id) on delete cascade,
  due_date      date not null,
  status        text not null default 'pendiente'
                  check (status in ('pendiente','hecha','omitida')),
  completed_at  timestamptz,
  completed_by  uuid references hogar.family_members(id) on delete set null,
  notes         text,
  cost          numeric(12,0),
  notified_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (definition_id, due_date)
);
create index on hogar.task_instances (family_id, status, due_date);

-- ============ Políticas RLS ============
-- Mismo patrón que migraciones 001/002/006: una sola condición por
-- política, sin lógica de roles.

alter table hogar.assets enable row level security;

create policy "assets_select" on hogar.assets
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "assets_insert" on hogar.assets
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "assets_update" on hogar.assets
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "assets_delete" on hogar.assets
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.task_definitions enable row level security;

create policy "task_definitions_select" on hogar.task_definitions
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "task_definitions_insert" on hogar.task_definitions
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "task_definitions_update" on hogar.task_definitions
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "task_definitions_delete" on hogar.task_definitions
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.task_instances enable row level security;

create policy "task_instances_select" on hogar.task_instances
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "task_instances_insert" on hogar.task_instances
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "task_instances_update" on hogar.task_instances
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "task_instances_delete" on hogar.task_instances
  for delete to authenticated
  using (family_id = hogar.current_family_id());

-- ============ Grants ============
-- Las migraciones 005 y 007 ya dejaron ALTER DEFAULT PRIVILEGES para
-- authenticated y service_role respectivamente, pero este proyecto ya
-- perdió tres migraciones asumiendo que alcanzaba con eso — se otorgan
-- explícitos igual (ver reglas 10 y 12 de CLAUDE.md).

grant select, insert, update, delete on hogar.assets to authenticated;
grant select, insert, update, delete on hogar.task_definitions to authenticated;
grant select, insert, update, delete on hogar.task_instances to authenticated;

-- ============ Nota para la Fase 4 (combustible) ============
-- hogar.assets ya contempla asset_type = 'vehiculo' a propósito: la
-- futura tabla `vehicles` deberá llevar un `asset_id` opcional apuntando
-- acá, para que el auto no exista dos veces en la base (el service es
-- una tarea de mantenimiento vía task_definitions, la carga de nafta es
-- otra cosa). No crear `vehicles` en esta migración.
