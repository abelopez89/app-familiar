-- ============ MIGRACIÓN 007: grants para service_role ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 006.
--
-- Por qué hace falta: las migraciones 004 y 005 le dieron privilegios
-- de schema/tabla/función a `authenticated`, pero nunca a `service_role`.
-- El rol `service_role` bypassea RLS, pero eso NO reemplaza los grants
-- de Postgres — son dos mecanismos independientes, igual que ya pasó
-- con `authenticated` en la migración 005. `service_role` recién se usa
-- de verdad en esta app con la Fase 2 (lib/supabase/admin.ts, vía el
-- feed ICS, el webhook de Telegram y el cron de recordatorios), así que
-- este agujero nunca se notó hasta ahora. Sin este grant, cualquier
-- consulta con el admin client falla con:
--   "permission denied for schema hogar" (42501)
--
-- El ALTER DEFAULT PRIVILEGES cubre las tablas/funciones/secuencias que
-- se creen de acá en adelante, para no repetir este problema con la
-- próxima fase.

grant usage on schema hogar to service_role;

grant select, insert, update, delete on all tables in schema hogar to service_role;
grant usage on all sequences in schema hogar to service_role;
grant execute on all functions in schema hogar to service_role;

alter default privileges in schema hogar
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema hogar
  grant usage on sequences to service_role;

alter default privileges in schema hogar
  grant execute on functions to service_role;
