-- 015 — Uso de promos en compras y combustible
--
-- Vincula una promo de tarjeta con una compra del súper (shopping_lists)
-- o una carga de combustible (fuel_logs): cuánto se descontó en caja,
-- cuánto se reintegra, y el acumulado por tarjeta contra los topes de la
-- promo. Ver "Promociones de tarjetas" en CLAUDE.md.
--
-- 1) promo_beneficio_componentes.tope_tipo: si el tope limita el monto
--    de COMPRA sobre el que se aplica el porcentaje ("compras hasta
--    Gs. 1.500.000") o el monto del DESCUENTO/reintegro ("reintegro hasta
--    Gs. 600.000"). null = no se sabe (las promos ya cargadas; el usuario
--    las corrige desde Editar). Global, como el resto de las promos.
--
-- 2) promo_usos: por familia, RLS estándar. Una fila por compra o carga
--    (exactamente una de las dos). Guarda una copia del cálculo (detalle):
--    si la promo se edita o se desactiva después, lo registrado no cambia
--    — mismo criterio que el snapshot de shopping_list_items. El monto que
--    se carga es el BRUTO (antes del descuento): la app calcula lo que
--    deberían cobrar en caja y el reintegro pendiente.

begin;

alter table hogar.promo_beneficio_componentes
  add column tope_tipo text check (tope_tipo in ('compra','descuento'));

create table hogar.promo_usos (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references hogar.families(id) on delete cascade,
  -- La promo y la tarjeta pueden desactivarse o borrarse después; el uso
  -- queda con la copia de título, banco y alias.
  promo_id             uuid references hogar.promociones(id) on delete set null,
  promo_titulo         text not null,
  banco                text not null,
  tarjeta_id           uuid references hogar.tarjetas_familia(id) on delete set null,
  tarjeta_alias        text not null,
  shopping_list_id     uuid unique references hogar.shopping_lists(id) on delete cascade,
  fuel_log_id          uuid unique references hogar.fuel_logs(id) on delete cascade,
  fecha                date not null,
  monto_bruto          numeric(14,0) not null check (monto_bruto > 0),
  descuento_caja       numeric(14,0) not null default 0 check (descuento_caja >= 0),
  reintegro            numeric(14,0) not null default 0 check (reintegro >= 0),
  -- Lo que se paga en caja y lo que termina costando con el reintegro.
  monto_caja           numeric(14,0) generated always as (monto_bruto - descuento_caja) stored,
  costo_final          numeric(14,0) generated always as (monto_bruto - descuento_caja - reintegro) stored,
  reintegro_acreditado boolean not null default false,
  -- Copia del cálculo: capa, componentes aplicados con su base, descuento
  -- y tope (lib/promos/ahorro.ts).
  detalle              jsonb not null default '{}'::jsonb,
  created_by           uuid references hogar.family_members(id) on delete set null,
  created_at           timestamptz not null default now(),
  check (num_nonnulls(shopping_list_id, fuel_log_id) = 1),
  check (descuento_caja + reintegro <= monto_bruto)
);
create index on hogar.promo_usos (family_id, fecha);
create index on hogar.promo_usos (promo_id, tarjeta_id);

alter table hogar.promo_usos enable row level security;

create policy "promo_usos_select" on hogar.promo_usos
  for select to authenticated using (family_id = hogar.current_family_id());
create policy "promo_usos_insert" on hogar.promo_usos
  for insert to authenticated with check (family_id = hogar.current_family_id());
create policy "promo_usos_update" on hogar.promo_usos
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());
create policy "promo_usos_delete" on hogar.promo_usos
  for delete to authenticated using (family_id = hogar.current_family_id());

-- Los default privileges de la 005 y la 007 ya lo cubren; explícito por
-- las dudas (reglas 10 y 12 de CLAUDE.md).
grant select, insert, update, delete on hogar.promo_usos to authenticated;
grant all on hogar.promo_usos to service_role;

commit;
