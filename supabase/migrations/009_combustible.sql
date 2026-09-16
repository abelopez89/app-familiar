-- ============ MIGRACIÓN 009: combustible (Fase 4) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 008.
--
-- Decisión central del módulo: el rendimiento SOLO se calcula entre
-- tanques llenos (is_full_tank = true). Una carga suelta no dice nada:
-- no se sabe cuánto combustible había antes ni cuánto quedó después. El
-- cálculo en sí vive en TypeScript (lib/fuel/consumption.ts), no acá —
-- ver la nota al final de este archivo sobre por qué no hay una vista
-- SQL para esto.

set search_path = hogar;

create table hogar.vehicles (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references hogar.families(id) on delete cascade,
  asset_id         uuid references hogar.assets(id) on delete set null,
  name             text not null,
  plate            text,
  fuel_type        text not null default 'nafta'
                     check (fuel_type in ('nafta','diesel','flex','gnv')),
  tank_capacity    numeric(6,2),
  initial_odometer numeric(10,1),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index on hogar.vehicles (family_id);

create table hogar.fuel_logs (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references hogar.families(id) on delete cascade,
  vehicle_id         uuid not null references hogar.vehicles(id) on delete cascade,
  member_id          uuid references hogar.family_members(id) on delete set null,
  filled_at          timestamptz not null default now(),
  odometer           numeric(10,1) not null,
  liters             numeric(8,2) not null check (liters > 0),
  total_amount       numeric(12,0),
  price_per_liter    numeric(10,2) generated always as
                       (case when liters > 0 then total_amount / liters end) stored,
  is_full_tank       boolean not null default true,
  resets_calculation boolean not null default false,
  station            text,
  fuel_grade         text,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (vehicle_id, odometer)
);
create index on hogar.fuel_logs (vehicle_id, odometer);

-- ============ Políticas RLS ============
-- Mismo patrón que el resto del proyecto: una sola condición por
-- política, sin lógica de roles.

alter table hogar.vehicles enable row level security;

create policy "vehicles_select" on hogar.vehicles
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "vehicles_insert" on hogar.vehicles
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "vehicles_update" on hogar.vehicles
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "vehicles_delete" on hogar.vehicles
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.fuel_logs enable row level security;

create policy "fuel_logs_select" on hogar.fuel_logs
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "fuel_logs_insert" on hogar.fuel_logs
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "fuel_logs_update" on hogar.fuel_logs
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "fuel_logs_delete" on hogar.fuel_logs
  for delete to authenticated
  using (family_id = hogar.current_family_id());

-- ============ Grants ============
-- Las migraciones 005 y 007 ya dejaron ALTER DEFAULT PRIVILEGES para
-- authenticated y service_role respectivamente, pero se otorgan
-- explícitos igual (ver reglas 10 y 12 de CLAUDE.md) — este módulo no
-- usa el admin client para nada, así que el grant a authenticated es el
-- que importa acá, pero se mantiene la misma disciplina.

grant select, insert, update, delete on hogar.vehicles to authenticated;
grant select, insert, update, delete on hogar.fuel_logs to authenticated;

-- ============ Por qué no hay una vista SQL ============
-- El cálculo de rendimiento entre tanques llenos vive en
-- lib/fuel/consumption.ts, no en una vista sobre estas tablas. Una vista
-- sobre tablas con RLS no hereda las políticas: corre con los privilegios
-- de su dueño salvo que se cree con `WITH (security_invoker = true)`.
-- Olvidarlo filtraría datos entre familias — exactamente la clase de
-- problema que ya costó las migraciones 004, 005 y 007. El volumen es
-- chico (unas cientos de filas por vehículo en toda su vida útil), así
-- que no hay ninguna ventaja de rendimiento en resolverlo en la base.
