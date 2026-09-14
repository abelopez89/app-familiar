-- ============ MIGRACIÓN 002: compras ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 001.

create table hogar.product_categories (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references hogar.families(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,   -- ORDEN DE RECORRIDO DEL SUPERMERCADO
  icon        text,
  created_at  timestamptz not null default now(),
  unique (family_id, name)
);

-- Una familia puede tener VARIAS plantillas
create table hogar.shopping_templates (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references hogar.families(id) on delete cascade,
  name         text not null,
  description  text,
  icon         text,
  is_default   boolean not null default false,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (family_id, name)
);

create table hogar.template_items (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references hogar.shopping_templates(id) on delete cascade,
  family_id         uuid not null references hogar.families(id) on delete cascade,
  name              text not null,
  category_id       uuid references hogar.product_categories(id) on delete set null,
  default_quantity  numeric(10,2) not null default 1,
  unit              text not null default 'un',
  is_staple         boolean not null default true,
  notes             text,
  sort_order        int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (template_id, name)
);

create table hogar.shopping_lists (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references hogar.families(id) on delete cascade,
  name                text,
  shopping_date       date not null default current_date,
  status              text not null default 'abierta'
                        check (status in ('abierta','en_curso','cerrada')),
  store               text,
  source_template_ids uuid[],
  total_amount        numeric(12,0),
  created_by          uuid references hogar.family_members(id) on delete set null,
  closed_at           timestamptz,
  created_at          timestamptz not null default now()
);

create table hogar.shopping_list_items (
  id                uuid primary key default gen_random_uuid(),
  list_id           uuid not null references hogar.shopping_lists(id) on delete cascade,
  family_id         uuid not null references hogar.families(id) on delete cascade,
  template_item_id  uuid references hogar.template_items(id) on delete set null,
  name              text not null,
  category_id       uuid references hogar.product_categories(id) on delete set null,
  category_name     text,
  quantity          numeric(10,2) not null default 1,
  unit              text not null default 'un',
  notes             text,
  is_checked        boolean not null default false,
  checked_at        timestamptz,
  checked_by        uuid references hogar.family_members(id) on delete set null,
  unit_price        numeric(12,0),
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);

create index on hogar.shopping_list_items (list_id);
create index on hogar.template_items (template_id);

-- ============ Políticas RLS ============
-- Mismo patrón que migración 001: una sola condición por política, sin
-- lógica de roles.

alter table hogar.product_categories enable row level security;

create policy "product_categories_select" on hogar.product_categories
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "product_categories_insert" on hogar.product_categories
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "product_categories_update" on hogar.product_categories
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "product_categories_delete" on hogar.product_categories
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.shopping_templates enable row level security;

create policy "shopping_templates_select" on hogar.shopping_templates
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "shopping_templates_insert" on hogar.shopping_templates
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "shopping_templates_update" on hogar.shopping_templates
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "shopping_templates_delete" on hogar.shopping_templates
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.template_items enable row level security;

create policy "template_items_select" on hogar.template_items
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "template_items_insert" on hogar.template_items
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "template_items_update" on hogar.template_items
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "template_items_delete" on hogar.template_items
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.shopping_lists enable row level security;

create policy "shopping_lists_select" on hogar.shopping_lists
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "shopping_lists_insert" on hogar.shopping_lists
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "shopping_lists_update" on hogar.shopping_lists
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "shopping_lists_delete" on hogar.shopping_lists
  for delete to authenticated
  using (family_id = hogar.current_family_id());

alter table hogar.shopping_list_items enable row level security;

create policy "shopping_list_items_select" on hogar.shopping_list_items
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "shopping_list_items_insert" on hogar.shopping_list_items
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "shopping_list_items_update" on hogar.shopping_list_items
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "shopping_list_items_delete" on hogar.shopping_list_items
  for delete to authenticated
  using (family_id = hogar.current_family_id());

-- ============ Realtime ============
-- Necesario para que el modo supermercado reciba los cambios de otros
-- celulares comprando la misma lista (postgres_changes sobre esta tabla).
alter publication supabase_realtime add table hogar.shopping_list_items;
