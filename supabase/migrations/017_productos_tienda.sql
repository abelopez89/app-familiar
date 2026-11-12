-- 017 — Productos de las tiendas online
--
-- Qué producto exacto de un súper online es cada producto de las listas
-- de compras de la familia: "Leche" → "Leche Trébol entera 1 L", con su
-- código (reference/SKU) y su unidad en la tienda. Lo elige la persona una
-- vez desde el marcador "Llenar carrito Real" (en su navegador, con su
-- sesión de Real), y la app lo recuerda para la próxima. La app nunca le
-- habla a la tienda: solo guarda lo que la persona eligió. Ver "Compras de
-- escritorio" en CLAUDE.md.
--
-- Por familia, RLS estándar (regla 5). Un producto de la lista tiene a lo
-- sumo un producto por tienda: `producto_clave` es el nombre normalizado
-- (`normalizeProductName`, el mismo criterio que la deduplicación de
-- plantillas), así "Leche" y "leche " son el mismo.

begin;

create table hogar.productos_tienda (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references hogar.families(id) on delete cascade,
  tienda           text not null check (tienda in ('real')),
  producto_clave   text not null check (length(producto_clave) between 1 and 200),
  producto_nombre  text not null,  -- como figura en la lista, para mostrar
  referencia       text not null,  -- código del producto en la tienda (SKU)
  nombre_tienda    text not null,  -- nombre del producto en la tienda
  unidad           text not null,  -- unidad en la tienda: "Kg", "Un"…
  created_by       uuid references hogar.family_members(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (family_id, tienda, producto_clave)
);

alter table hogar.productos_tienda enable row level security;

create policy "productos_tienda_select" on hogar.productos_tienda
  for select to authenticated using (family_id = hogar.current_family_id());
create policy "productos_tienda_insert" on hogar.productos_tienda
  for insert to authenticated with check (family_id = hogar.current_family_id());
create policy "productos_tienda_update" on hogar.productos_tienda
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());
create policy "productos_tienda_delete" on hogar.productos_tienda
  for delete to authenticated using (family_id = hogar.current_family_id());

create trigger productos_tienda_set_updated_at
  before update on hogar.productos_tienda
  for each row execute function hogar.set_updated_at();

-- Los default privileges de la 005 y la 007 ya lo cubren; explícito por
-- las dudas (reglas 10 y 12 de CLAUDE.md).
grant select, insert, update, delete on hogar.productos_tienda to authenticated;
grant all on hogar.productos_tienda to service_role;

commit;
