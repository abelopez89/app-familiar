-- ============ MIGRACIÓN 003: alta en login (no solo en signup) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 002.
--
-- Por qué hace falta: `hogar.handle_new_user()` (migración 001) solo se
-- dispara con `AFTER INSERT ON auth.users`, es decir, la primera vez que
-- ese email se registra en CUALQUIERA de las 4 apps que comparten este
-- proyecto de Supabase. Si alguien ya tenía cuenta en otra app (mismo
-- email o misma cuenta de Google), su fila en auth.users ya existe, así
-- que iniciar sesión en app-familiar por primera vez NO dispara el
-- trigger — y esa persona nunca queda vinculada a una familia acá.
--
-- Esta función hace la misma lógica de vinculación (por email invitado o
-- familia nueva) pero de forma idempotente y basada en auth.uid(), para
-- poder llamarla en cada login exitoso (Server Action de login, callback
-- de OAuth), no solo en el alta.

create or replace function hogar.ensure_family_membership()
returns void
language plpgsql security definer set search_path = hogar
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_member_id uuid;
  v_family_id uuid;
begin
  if v_user_id is null then
    return;
  end if;

  -- Ya tiene un miembro vinculado (activo o no): no hacer nada.
  if exists (select 1 from hogar.family_members where user_id = v_user_id) then
    return;
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    return;
  end if;

  select id into v_member_id
    from hogar.family_members
   where lower(email) = lower(v_email)
     and user_id is null
     and can_login
   limit 1;

  if v_member_id is not null then
    update hogar.family_members set user_id = v_user_id where id = v_member_id;
  else
    insert into hogar.families (name)
      values ('Familia de ' || split_part(v_email, '@', 1))
      returning id into v_family_id;

    insert into hogar.family_members (family_id, user_id, email, display_name, role, can_login)
      values (v_family_id, v_user_id, v_email, split_part(v_email, '@', 1), 'adulto', true);
  end if;
end $$;

grant execute on function hogar.ensure_family_membership() to authenticated;
