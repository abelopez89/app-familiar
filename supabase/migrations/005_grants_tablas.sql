-- ============ MIGRACIÓN 005: grants base sobre tablas y secuencias ============
-- Aplicar a mano desde el SQL Editor de Supabase, después de la 004.
--
-- Por qué hace falta: RLS solo RESTRINGE FILAS a las que un rol ya tiene
-- permiso de acceder — no reemplaza el privilegio de tabla en sí. Sin un
-- `GRANT` explícito, Postgres rechaza la consulta antes de siquiera
-- evaluar las políticas, con:
--   "permission denied for table <tabla>" (42501)
-- Al exponer el schema `hogar` a la API nunca se corrió este grant base
-- para el rol `authenticated`, así que probablemente ninguna consulta
-- autenticada contra estas tablas funcionó nunca desde la app (solo
-- parecía andar cuando se probaba desde el SQL Editor, que corre como
-- postgres y no pasa por estos chequeos).
--
-- El ALTER DEFAULT PRIVILEGES es la parte importante para las fases
-- futuras: cualquier tabla nueva que se cree de acá en adelante en el
-- schema hogar (eventos, tareas, documentos, combustible) queda con
-- estos mismos privilegios automáticamente, sin tener que repetir este
-- grant a mano cada vez.

grant select, insert, update, delete on all tables in schema hogar to authenticated;
grant usage on all sequences in schema hogar to authenticated;

alter default privileges in schema hogar
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema hogar
  grant usage on sequences to authenticated;
