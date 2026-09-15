-- ============ MIGRACIÓN 006: eventos (Fase 2) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 005.

set search_path = hogar;

-- Trigger genérico de updated_at (lo necesita el feed ICS para
-- SEQUENCE/LAST-MODIFIED — ver lib/ics.ts).
create or replace function hogar.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table hogar.events (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references hogar.families(id) on delete cascade,
  title            text not null,
  description      text,
  category         text not null default 'familiar'
                     check (category in ('escolar','medico','familiar','cumpleanos','otro')),
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  all_day          boolean not null default false,
  location         text,
  recurrence       text check (recurrence in ('weekly','monthly','yearly')),
  recurrence_until date,
  created_by       uuid references hogar.family_members(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on hogar.events (family_id, starts_at);
create index on hogar.events (family_id, recurrence) where recurrence is not null;

create trigger events_set_updated_at
  before update on hogar.events
  for each row execute function hogar.set_updated_at();

create table hogar.event_participants (
  event_id   uuid not null references hogar.events(id) on delete cascade,
  member_id  uuid not null references hogar.family_members(id) on delete cascade,
  family_id  uuid not null references hogar.families(id) on delete cascade,
  primary key (event_id, member_id)
);
create index on hogar.event_participants (member_id);

create table hogar.event_reminders (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references hogar.events(id) on delete cascade,
  family_id      uuid not null references hogar.families(id) on delete cascade,
  offset_minutes int not null,
  channel        text not null default 'calendar'
                   check (channel in ('calendar','telegram')),
  target_member  uuid references hogar.family_members(id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index on hogar.event_reminders (event_id);

-- Vinculación de Telegram
create table hogar.telegram_link_codes (
  code        text primary key,
  member_id   uuid not null references hogar.family_members(id) on delete cascade,
  family_id   uuid not null references hogar.families(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Idempotencia de envíos: una fila por recordatorio, ocurrencia y destinatario.
-- Ver nota al final de este archivo sobre por qué no alcanza un sent_at
-- en event_reminders.
create table hogar.reminder_deliveries (
  reminder_id          uuid not null references hogar.event_reminders(id) on delete cascade,
  occurrence_starts_at timestamptz not null,
  member_id            uuid not null references hogar.family_members(id) on delete cascade,
  sent_at              timestamptz not null default now(),
  primary key (reminder_id, occurrence_starts_at, member_id)
);

-- ============ Políticas RLS ============
-- Mismo patrón que migraciones 001/002: una sola condición por política,
-- sin lógica de roles.

alter table hogar.events enable row level security;

create policy "events_select" on hogar.events
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "events_insert" on hogar.events
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "events_update" on hogar.events
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "events_delete" on hogar.events
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.event_participants enable row level security;

create policy "event_participants_select" on hogar.event_participants
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "event_participants_insert" on hogar.event_participants
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "event_participants_update" on hogar.event_participants
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "event_participants_delete" on hogar.event_participants
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.event_reminders enable row level security;

create policy "event_reminders_select" on hogar.event_reminders
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "event_reminders_insert" on hogar.event_reminders
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "event_reminders_update" on hogar.event_reminders
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "event_reminders_delete" on hogar.event_reminders
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.telegram_link_codes enable row level security;

create policy "telegram_link_codes_select" on hogar.telegram_link_codes
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "telegram_link_codes_insert" on hogar.telegram_link_codes
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "telegram_link_codes_update" on hogar.telegram_link_codes
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "telegram_link_codes_delete" on hogar.telegram_link_codes
  for delete to authenticated
  using (family_id = hogar.current_family_id());

-- reminder_deliveries no tiene family_id: solo la toca el cron con
-- service role (que bypassea RLS). Política restrictiva explícita para
-- que ningún rol authenticated pueda leerla ni escribirla directamente.
alter table hogar.reminder_deliveries enable row level security;

create policy "reminder_deliveries_no_access" on hogar.reminder_deliveries
  for all to authenticated
  using (false)
  with check (false);

-- ============ Grants ============
-- La migración 005 ya dejó un ALTER DEFAULT PRIVILEGES que cubre tablas
-- nuevas automáticamente, pero este proyecto ya perdió dos migraciones
-- por asumir que alcanzaba con eso — se otorgan explícitos igual.

grant select, insert, update, delete on hogar.events to authenticated;
grant select, insert, update, delete on hogar.event_participants to authenticated;
grant select, insert, update, delete on hogar.event_reminders to authenticated;
grant select, insert, update, delete on hogar.telegram_link_codes to authenticated;

-- reminder_deliveries: sin grant a authenticated a propósito. Solo la
-- toca el cron con service role, que ignora tanto RLS como los grants
-- de rol (usa su propio rol con privilegios totales).

-- ============ Por qué reminder_deliveries y no un sent_at ============
-- Un recordatorio sobre un evento recurrente (weekly/monthly/yearly)
-- tiene que dispararse una vez por ocurrencia, no una sola vez para
-- siempre. Un campo sent_at en event_reminders marcaría el recordatorio
-- como "ya enviado" después de la primera ocurrencia y nunca volvería a
-- avisar las siguientes. La primary key compuesta
-- (reminder_id, occurrence_starts_at, member_id) además hace el envío
-- idempotente por construcción: si dos corridas del cron se solapan, el
-- insert de la segunda choca contra la primary key y no se duplica el
-- mensaje — no hace falta un lock ni una transacción especial.
