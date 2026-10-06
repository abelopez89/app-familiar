-- ============ MIGRACIÓN 013: save_expense() para el bot de Telegram (Fase 7) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 012.
--
-- Por qué: `hogar.save_expense()` (migración 011) toma la familia de
-- `hogar.current_family_id()`, que sale de la sesión (`auth.uid()`). El
-- bot de Telegram no tiene sesión — trabaja con el admin client (service
-- role) — así que ahí `current_family_id()` es null y la función rechaza
-- todo gasto con 'Sin familia'. La alternativa (insertar gasto y partes
-- desde el código con dos llamadas) perdería la transacción, que es
-- justamente lo que esta función existe para garantizar.
--
-- Qué cambia (el resto del cuerpo es idéntico al de la 011):
--   1. Si no hay sesión Y quien llama es service_role, la familia y el
--      miembro se toman de `p_expense.family_id` / `p_expense.created_by`
--      (el código del bot los resuelve desde telegram_user_id). Se
--      verifica que el miembro sea de esa familia.
--   2. Como service_role no pasa por RLS, se verifica a mano que el grupo
--      sea de la familia, y la edición filtra por family_id. Con sesión
--      estas dos comprobaciones son redundantes con RLS (no cambian nada).
--   3. `created_by` usa `v_member_id` (con sesión sigue siendo
--      `hogar.current_member_id()`, igual que antes).
--
-- Para un usuario autenticado no cambia nada: `current_family_id()` no es
-- null, el payload extra se ignora y RLS sigue aplicando adentro
-- (security invoker). La firma no cambia, así que el grant de la 011
-- sigue valiendo; se repite explícito igual, más el de service_role.

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
  v_member_id  uuid := hogar.current_member_id();
  v_id         uuid;
  v_group_id   uuid;
  v_paid_by    uuid := (p_expense->>'paid_by')::uuid;
  v_amount_pyg numeric;
  v_sum        numeric;
begin
  -- Sin sesión (bot de Telegram, admin client): la familia y el miembro
  -- vienen en el payload. SOLO para service_role — para cualquier otro
  -- rol se ignoran y manda la sesión, como siempre. `current_user` es el
  -- rol al que PostgREST cambió para este request (security invoker), y
  -- un usuario autenticado no puede hacerse pasar por service_role.
  if v_family_id is null and current_user = 'service_role' then
    v_family_id := nullif(p_expense->>'family_id', '')::uuid;
    v_member_id := nullif(p_expense->>'created_by', '')::uuid;

    if v_member_id is not null and not exists (
      select 1 from hogar.family_members
      where id = v_member_id and family_id = v_family_id
    ) then
      raise exception 'El miembro no es de esta familia' using errcode = '42501';
    end if;
  end if;

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
      v_member_id
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
      and family_id = v_family_id
    returning id, group_id, amount_pyg into v_id, v_group_id, v_amount_pyg;

    if v_id is null then
      raise exception 'Gasto no encontrado' using errcode = 'P0002';
    end if;
  end if;

  -- Con service_role no hay RLS que impida apuntar a un grupo de otra
  -- familia: se verifica a mano (con sesión es redundante e inofensivo).
  if not exists (
    select 1 from hogar.expense_groups
    where id = v_group_id and family_id = v_family_id
  ) then
    raise exception 'Grupo no encontrado' using errcode = '42501';
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

grant execute on function hogar.save_expense(uuid, jsonb, jsonb) to authenticated;
grant execute on function hogar.save_expense(uuid, jsonb, jsonb) to service_role;
