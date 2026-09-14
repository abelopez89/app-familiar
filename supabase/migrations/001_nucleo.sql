-- ============ MIGRACIÓN 001: núcleo ============
-- Familias, miembros, funciones helper de RLS, trigger de alta de usuario
-- y políticas RLS. Aplicar a mano desde el SQL Editor de Supabase.

create table hogar.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'America/Asuncion',
  created_at  timestamptz not null default now()
);

create table hogar.family_members (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references hogar.families(id) on delete cascade,
  user_id           uuid unique references auth.users(id) on delete set null,
  email             text,
  display_name      text not null,
  color             text not null default '#6366f1',
  role              text not null default 'adulto' check (role in ('adulto','menor')),
  can_login         boolean not null default true,
  birth_date        date,
  telegram_user_id  bigint unique,
  calendar_token    uuid not null unique default gen_random_uuid(),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (family_id, email)
);

create index on hogar.family_members (family_id);
create index on hogar.family_members (user_id);

-- ============ Funciones helper para RLS ============
-- security definer para evitar la recursión infinita que ocurre cuando
-- una política de family_members consulta family_members. No simplificar.

create or replace function hogar.current_family_id()
returns uuid
language sql stable security definer set search_path = hogar
as $$
  select family_id from hogar.family_members
  where user_id = auth.uid() and is_active limit 1;
$$;

create or replace function hogar.current_member_id()
returns uuid
language sql stable security definer set search_path = hogar
as $$
  select id from hogar.family_members
  where user_id = auth.uid() and is_active limit 1;
$$;

-- ============ Trigger de alta de usuario — CRÍTICO ============
-- Si el email ya fue dado de alta como miembro de una familia existente
-- (sin user_id todavía), se lo vincula. Si no, se crea una familia nueva
-- y queda como primer adulto. Sin esto, el segundo adulto que se registra
-- termina con su propia familia vacía en lugar de la existente.

create or replace function hogar.handle_new_user()
returns trigger
language plpgsql security definer set search_path = hogar
as $$
declare
  v_member_id uuid;
  v_family_id uuid;
begin
  select id into v_member_id
    from hogar.family_members
   where lower(email) = lower(new.email)
     and user_id is null
     and can_login
   limit 1;

  if v_member_id is not null then
    update hogar.family_members set user_id = new.id where id = v_member_id;
  else
    insert into hogar.families (name)
      values ('Familia de ' || split_part(new.email, '@', 1))
      returning id into v_family_id;

    insert into hogar.family_members (family_id, user_id, email, display_name, role, can_login)
      values (v_family_id, new.id, new.email, split_part(new.email, '@', 1), 'adulto', true);
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function hogar.handle_new_user();

-- ============ Políticas RLS ============
-- Todo usuario autenticado es adulto y ve todo lo de su familia.
-- Sin lógica de roles: una sola condición por política.

alter table hogar.families enable row level security;

create policy "families_select" on hogar.families
  for select to authenticated
  using (id = hogar.current_family_id());

create policy "families_insert" on hogar.families
  for insert to authenticated
  with check (id = hogar.current_family_id());

create policy "families_update" on hogar.families
  for update to authenticated
  using (id = hogar.current_family_id())
  with check (id = hogar.current_family_id());

create policy "families_delete" on hogar.families
  for delete to authenticated
  using (id = hogar.current_family_id());

alter table hogar.family_members enable row level security;

create policy "members_select" on hogar.family_members
  for select to authenticated
  using (family_id = hogar.current_family_id());

create policy "members_insert" on hogar.family_members
  for insert to authenticated
  with check (family_id = hogar.current_family_id());

create policy "members_update" on hogar.family_members
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());

create policy "members_delete" on hogar.family_members
  for delete to authenticated
  using (family_id = hogar.current_family_id());
