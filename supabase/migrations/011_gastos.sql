-- ============ MIGRACIÓN 011: gastos compartidos (Fase 6) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 010.
--
-- Objetivo único del módulo: repartir gastos entre varias personas y
-- saber quién le debe cuánto a quién. No es un control de gastos
-- personales ni un presupuesto.
--
-- Decisiones del modelo (ver CLAUDE.md, sección Fase 6):
--
-- * Cada gasto guarda tres cosas: `amount` + `currency` (lo que dice el
--   ticket), `exchange_rate` (hace auditable la conversión) y
--   `amount_pyg` (columna generada, lo único con lo que se puede sumar un
--   viaje en tres monedas). Generada para que editar la cotización días
--   después — la tarjeta de crédito liquida con el resumen — recalcule
--   sola el importe en guaraníes.
-- * Las partes se materializan SIEMPRE en `expense_shares`, en enteros de
--   guaraníes, aunque la división haya sido en partes iguales. Mismo
--   principio que los items de compras (Fase 1): sumar un participante el
--   día 5 del viaje no reescribe lo que cada uno debía el día 1.
-- * La suma de las partes es exactamente `amount_pyg`. Lo garantiza
--   `hogar.save_expense()` (abajo), que guarda gasto y partes en una sola
--   transacción y rechaza el gasto si no cuadra.
-- * `display_name` del participante es un snapshot, igual que
--   `shopping_list_items.name`.
-- * Un solo pagador por gasto. Los invitados son por grupo (no hay
--   directorio global de personas externas).
-- * `status` del grupo no condiciona ningún cálculo: es solo archivo.

set search_path = hogar;

create table hogar.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references hogar.families(id) on delete cascade,
  name       text not null,
  icon       text,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (family_id, name)
);

create table hogar.expense_groups (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references hogar.families(id) on delete cascade,
  name          text not null,
  description   text,
  kind          text not null default 'otro'
                  check (kind in ('viaje','evento','otro')),
  starts_on     date,
  ends_on       date,
  status        text not null default 'abierto'
                  check (status in ('abierto','cerrado')),
  default_rates jsonb,        -- {"BRL": 1450, "ARS": 5.2, "USD": 7300}
  created_by    uuid references hogar.family_members(id) on delete set null,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on hogar.expense_groups (family_id, status);

create trigger expense_groups_set_updated_at
  before update on hogar.expense_groups
  for each row execute function hogar.set_updated_at();

create table hogar.group_participants (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references hogar.expense_groups(id) on delete cascade,
  family_id    uuid not null references hogar.families(id) on delete cascade,
  member_id    uuid references hogar.family_members(id) on delete set null,
  display_name text not null,
  color        text,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on hogar.group_participants (group_id);

create table hogar.expenses (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null references hogar.expense_groups(id) on delete cascade,
  family_id           uuid not null references hogar.families(id) on delete cascade,
  paid_by             uuid not null references hogar.group_participants(id) on delete restrict,
  category_id         uuid references hogar.expense_categories(id) on delete set null,
  description         text not null,
  spent_on            date not null default current_date,
  amount              numeric(14,2) not null check (amount > 0),
  currency            text not null default 'PYG',
  exchange_rate       numeric(14,6) not null default 1 check (exchange_rate > 0),
  amount_pyg          numeric(14,0) generated always as
                        (round(amount * exchange_rate)) stored,
  payment_method      text not null default 'efectivo'
                        check (payment_method in
                          ('efectivo','transferencia','tarjeta_credito','tarjeta_debito','otro')),
  split_method        text not null default 'iguales'
                        check (split_method in ('iguales','partes','exactos')),
  receipt_document_id uuid references hogar.documents(id) on delete set null,
  notes               text,
  created_by          uuid references hogar.family_members(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on hogar.expenses (group_id, spent_on desc);

create trigger expenses_set_updated_at
  before update on hogar.expenses
  for each row execute function hogar.set_updated_at();

create table hogar.expense_shares (
  expense_id     uuid not null references hogar.expenses(id) on delete cascade,
  participant_id uuid not null references hogar.group_participants(id) on delete cascade,
  family_id      uuid not null references hogar.families(id) on delete cascade,
  share_pyg      numeric(14,0) not null check (share_pyg >= 0),
  weight         numeric(8,2),
  primary key (expense_id, participant_id)
);
create index on hogar.expense_shares (participant_id);

create table hogar.settlements (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references hogar.expense_groups(id) on delete cascade,
  family_id        uuid not null references hogar.families(id) on delete cascade,
  from_participant uuid not null references hogar.group_participants(id) on delete restrict,
  to_participant   uuid not null references hogar.group_participants(id) on delete restrict,
  amount_pyg       numeric(14,0) not null check (amount_pyg > 0),
  settled_on       date not null default current_date,
  payment_method   text not null default 'efectivo',
  notes            text,
  created_by       uuid references hogar.family_members(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (from_participant <> to_participant)
);
create index on hogar.settlements (group_id);

-- ============ RLS ============
-- Mismo patrón que el resto del proyecto: una sola condición por
-- política, sin lógica de roles.

alter table hogar.expense_categories enable row level security;

create policy "expense_categories_select" on hogar.expense_categories
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "expense_categories_insert" on hogar.expense_categories
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "expense_categories_update" on hogar.expense_categories
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "expense_categories_delete" on hogar.expense_categories
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.expense_groups enable row level security;

create policy "expense_groups_select" on hogar.expense_groups
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "expense_groups_insert" on hogar.expense_groups
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "expense_groups_update" on hogar.expense_groups
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "expense_groups_delete" on hogar.expense_groups
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.group_participants enable row level security;

create policy "group_participants_select" on hogar.group_participants
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "group_participants_insert" on hogar.group_participants
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "group_participants_update" on hogar.group_participants
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "group_participants_delete" on hogar.group_participants
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.expenses enable row level security;

create policy "expenses_select" on hogar.expenses
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "expenses_insert" on hogar.expenses
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "expenses_update" on hogar.expenses
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "expenses_delete" on hogar.expenses
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.expense_shares enable row level security;

create policy "expense_shares_select" on hogar.expense_shares
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "expense_shares_insert" on hogar.expense_shares
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "expense_shares_update" on hogar.expense_shares
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "expense_shares_delete" on hogar.expense_shares
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.settlements enable row level security;

create policy "settlements_select" on hogar.settlements
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "settlements_insert" on hogar.settlements
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "settlements_update" on hogar.settlements
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "settlements_delete" on hogar.settlements
  for delete to authenticated
  using (family_id = hogar.current_family_id());

-- ============ hogar.save_expense() ============
-- Guarda un gasto y reemplaza sus partes en UNA transacción, y rechaza
-- el gasto si las partes no suman exactamente `amount_pyg`.
--
-- Por qué una función y no dos llamadas desde el código: PostgREST no
-- tiene transacciones entre requests. Con insert del gasto + insert de
-- las partes por separado, un fallo en el medio deja un gasto sin partes
-- (y el balance del grupo deja de sumar cero). Lo mismo al editar la
-- cotización: el importe en guaraníes cambia solo (columna generada) y
-- las partes tienen que reescribirse en el mismo paso, o quedan
-- descuadradas respecto del nuevo total.
--
-- La división en sí NO vive acá: la calcula `lib/expenses/split.ts` y la
-- manda armada. Esta función solo garantiza atomicidad e invariantes:
-- suma exacta, pagador y participantes del mismo grupo.
--
-- `security invoker` a propósito: corre con los permisos de quien llama,
-- así que RLS sigue aplicando a cada insert/update/delete de adentro.
--
-- p_expense_id null → alta; si no, edición (el grupo no se puede cambiar).
-- p_expense: {group_id, paid_by, category_id, description, spent_on,
--             amount, currency, exchange_rate, payment_method,
--             split_method, receipt_document_id, notes}
-- p_shares:  [{participant_id, share_pyg, weight}, ...]

create or replace function hogar.save_expense(
  p_expense_id uuid,
  p_expense    jsonb,
  p_shares     jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = hogar
as $$
declare
  v_family_id  uuid := hogar.current_family_id();
  v_id         uuid;
  v_group_id   uuid;
  v_paid_by    uuid := (p_expense->>'paid_by')::uuid;
  v_amount_pyg numeric;
  v_sum        numeric;
begin
  if v_family_id is null then
    raise exception 'Sin familia' using errcode = '42501';
  end if;

  if p_shares is null or jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'El gasto tiene que dividirse entre al menos una persona' using errcode = '23514';
  end if;

  if p_expense_id is null then
    insert into hogar.expenses (
      group_id, family_id, paid_by, category_id, description, spent_on,
      amount, currency, exchange_rate, payment_method, split_method,
      receipt_document_id, notes, created_by
    ) values (
      (p_expense->>'group_id')::uuid,
      v_family_id,
      v_paid_by,
      nullif(p_expense->>'category_id', '')::uuid,
      p_expense->>'description',
      coalesce(nullif(p_expense->>'spent_on', '')::date, current_date),
      (p_expense->>'amount')::numeric,
      coalesce(nullif(p_expense->>'currency', ''), 'PYG'),
      coalesce(nullif(p_expense->>'exchange_rate', '')::numeric, 1),
      coalesce(nullif(p_expense->>'payment_method', ''), 'efectivo'),
      coalesce(nullif(p_expense->>'split_method', ''), 'iguales'),
      nullif(p_expense->>'receipt_document_id', '')::uuid,
      nullif(p_expense->>'notes', ''),
      hogar.current_member_id()
    )
    returning id, group_id, amount_pyg into v_id, v_group_id, v_amount_pyg;
  else
    update hogar.expenses set
      paid_by             = v_paid_by,
      category_id         = nullif(p_expense->>'category_id', '')::uuid,
      description         = p_expense->>'description',
      spent_on            = coalesce(nullif(p_expense->>'spent_on', '')::date, spent_on),
      amount              = (p_expense->>'amount')::numeric,
      currency            = coalesce(nullif(p_expense->>'currency', ''), 'PYG'),
      exchange_rate       = coalesce(nullif(p_expense->>'exchange_rate', '')::numeric, 1),
      payment_method      = coalesce(nullif(p_expense->>'payment_method', ''), 'efectivo'),
      split_method        = coalesce(nullif(p_expense->>'split_method', ''), 'iguales'),
      receipt_document_id = nullif(p_expense->>'receipt_document_id', '')::uuid,
      notes               = nullif(p_expense->>'notes', '')
    where id = p_expense_id
    returning id, group_id, amount_pyg into v_id, v_group_id, v_amount_pyg;

    if v_id is null then
      raise exception 'Gasto no encontrado' using errcode = 'P0002';
    end if;
  end if;

  if not exists (
    select 1 from hogar.group_participants
    where id = v_paid_by and group_id = v_group_id
  ) then
    raise exception 'Quien pagó no participa de este grupo' using errcode = '23514';
  end if;

  delete from hogar.expense_shares where expense_id = v_id;

  insert into hogar.expense_shares (expense_id, participant_id, family_id, share_pyg, weight)
  select
    v_id,
    (s->>'participant_id')::uuid,
    v_family_id,
    (s->>'share_pyg')::numeric,
    nullif(s->>'weight', '')::numeric
  from jsonb_array_elements(p_shares) as s;

  if exists (
    select 1
    from hogar.expense_shares es
    left join hogar.group_participants gp
      on gp.id = es.participant_id and gp.group_id = v_group_id
    where es.expense_id = v_id and gp.id is null
  ) then
    raise exception 'Una de las partes es de alguien que no participa de este grupo' using errcode = '23514';
  end if;

  select coalesce(sum(share_pyg), 0) into v_sum
  from hogar.expense_shares
  where expense_id = v_id;

  if v_sum <> v_amount_pyg then
    raise exception 'Las partes suman % y el gasto es de % Gs', v_sum, v_amount_pyg
      using errcode = '23514';
  end if;

  return v_id;
end;
$$;

-- ============ Grants ============
-- Explícitos igual que en 009 y 010, aunque 005/007 dejaron ALTER
-- DEFAULT PRIVILEGES (ver reglas 7, 10 y 12 de CLAUDE.md).

grant select, insert, update, delete on hogar.expense_categories to authenticated;
grant select, insert, update, delete on hogar.expense_groups     to authenticated;
grant select, insert, update, delete on hogar.group_participants to authenticated;
grant select, insert, update, delete on hogar.expenses           to authenticated;
grant select, insert, update, delete on hogar.expense_shares     to authenticated;
grant select, insert, update, delete on hogar.settlements        to authenticated;

grant execute on function hogar.save_expense(uuid, jsonb, jsonb) to authenticated;

-- ============ Seed de categorías ============
-- A diferencia de 010 (seed aparte con el family_id a mano), acá se
-- siembra para todas las familias existentes en el mismo paso: no hace
-- falta reemplazar ningún UUID. Una familia creada después arranca sin
-- categorías y las carga desde /config/gastos (hay un botón para
-- agregar estas mismas sugeridas). `icon` es el nombre del ícono de
-- lucide que usa la app (ver lib/expenses/constants.ts).

insert into hogar.expense_categories (family_id, name, icon, sort_order)
select f.id, c.name, c.icon, c.sort_order
from hogar.families f
cross join (values
  ('Hotel',       'bed',          1),
  ('Combustible', 'fuel',         2),
  ('Comida',      'utensils',     3),
  ('Postre',      'ice-cream',    4),
  ('Transporte',  'bus',          5),
  ('Paseos',      'map',          6),
  ('Compras',     'shopping-bag', 7),
  ('Regalos',     'gift',         8),
  ('Peajes',      'ticket',       9),
  ('Otros',       'ellipsis',    10)
) as c(name, icon, sort_order)
on conflict (family_id, name) do nothing;
