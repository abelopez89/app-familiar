-- ============ MIGRACIÓN 012: bot conversacional de Telegram (Fase 7) ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 011.
--
-- Dos tablas que solo toca el webhook de Telegram (y el cron diario, para
-- la limpieza) con el admin client (service role). Ningún usuario
-- autenticado las lee ni las escribe: el bot no tiene sesión, y la app no
-- tiene nada que mostrar de acá.

set search_path = hogar;

-- ============ telegram_sessions ============
-- Estado del diálogo entre mensajes (el webhook es stateless). Una fila
-- por usuario de Telegram: un diálogo nuevo pisa al anterior.
--
-- member_id / family_id se copian al abrir la sesión, pero el webhook los
-- vuelve a resolver contra family_members.telegram_user_id en cada update
-- y descarta la sesión si no coinciden (miembro desvinculado o vinculado
-- a otra familia). La vinculación manda; esta tabla es solo un caché del
-- diálogo.
--
-- expires_at: las sesiones viven 10 minutos desde la última interacción.
-- Un diálogo abandonado no puede interpretar un mensaje suelto de mañana
-- como "el monto del gasto".
--
-- chat_id / last_message_id: el mensaje que el bot edita en vez de mandar
-- uno nuevo (la lista de compras se actualiza en el mismo mensaje).

create table hogar.telegram_sessions (
  telegram_user_id bigint primary key,
  member_id        uuid not null references hogar.family_members(id) on delete cascade,
  family_id        uuid not null references hogar.families(id) on delete cascade,
  state            text,
  context          jsonb not null default '{}'::jsonb,
  chat_id          bigint,
  last_message_id  bigint,
  expires_at       timestamptz,
  updated_at       timestamptz not null default now()
);

create index on hogar.telegram_sessions (member_id);

create trigger telegram_sessions_set_updated_at
  before update on hogar.telegram_sessions
  for each row execute function hogar.set_updated_at();

-- ============ telegram_updates ============
-- Deduplicación por update_id. Telegram reintenta el mismo update si el
-- webhook tarda o falla, y un reintento sobre "guardar gasto" crearía un
-- gasto duplicado. El webhook inserta acá ANTES de procesar: si el insert
-- choca contra la primary key, el update ya se procesó (o se está
-- procesando) y se responde 200 sin hacer nada. Mismo principio que
-- reminder_deliveries (Fase 2): la primary key es el lock.
--
-- Crece sin límite: el cron diario (/api/cron/tareas) borra las filas de
-- más de 7 días. El índice por received_at es para ese borrado.

create table hogar.telegram_updates (
  update_id   bigint primary key,
  received_at timestamptz not null default now()
);

create index on hogar.telegram_updates (received_at);

-- ============ RLS ============
-- RLS activo y una política restrictiva explícita, mismo patrón que
-- reminder_deliveries (migración 006): ningún rol authenticated puede
-- leerlas ni escribirlas. service_role bypassea RLS.

alter table hogar.telegram_sessions enable row level security;

create policy "telegram_sessions_no_access" on hogar.telegram_sessions
  for all to authenticated
  using (false)
  with check (false);

alter table hogar.telegram_updates enable row level security;

create policy "telegram_updates_no_access" on hogar.telegram_updates
  for all to authenticated
  using (false)
  with check (false);

-- ============ Grants ============
-- El ALTER DEFAULT PRIVILEGES de la migración 005 le da
-- select/insert/update/delete a authenticated sobre CUALQUIER tabla nueva
-- de hogar — incluidas estas. Se revoca explícito: la política de arriba
-- ya bloquea todo, pero sin privilegio de tabla ni siquiera llega a
-- evaluarse (dos barreras en vez de una). Lo mismo para anon, por si
-- algún default privilege del proyecto compartido lo alcanza.

revoke all on hogar.telegram_sessions from authenticated, anon;
revoke all on hogar.telegram_updates from authenticated, anon;

-- service_role: la 007 dejó un default privilege que ya cubre tablas
-- nuevas, pero este proyecto aprendió a no asumirlo (regla 12 del
-- CLAUDE.md) — se otorga explícito igual.

grant select, insert, update, delete on hogar.telegram_sessions to service_role;
grant select, insert, update, delete on hogar.telegram_updates to service_role;
