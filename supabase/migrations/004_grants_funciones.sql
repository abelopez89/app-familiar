-- ============ MIGRACIÓN 004: grants para funciones vía RPC ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 003.
--
-- Por qué hace falta: hasta ahora, todas las funciones del schema hogar
-- (current_family_id, current_member_id, handle_new_user) se invocan de
-- forma interna — desde expresiones de políticas RLS o desde un trigger
-- — y esos caminos no requieren privilegios de EXECUTE para los roles
-- anon/authenticated. hogar.ensure_family_membership() (migración 003)
-- es la primera función que se llama vía el endpoint RPC de PostgREST
-- (`supabase.rpc(...)`), que sí necesita privilegios explícitos.
-- Sin este grant, la llamada falla con:
--   "permission denied for schema hogar" (42501)
--
-- El GRANT ... ON ALL FUNCTIONS cubre las funciones ya creadas; el
-- ALTER DEFAULT PRIVILEGES cubre las que se creen de acá en adelante,
-- para no repetir este problema con la próxima función que se llame
-- por RPC.

grant usage on schema hogar to authenticated;

grant execute on all functions in schema hogar to authenticated;

alter default privileges in schema hogar
  grant execute on functions to authenticated;
