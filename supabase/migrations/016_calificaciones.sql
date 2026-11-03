-- 016 — Calificaciones del colegio
--
-- El informe mensual del colegio (PDF) se guarda en el Centro de
-- Documentos como siempre (doc_type = 'calificaciones', member_id = el
-- hijo). Estas tablas guardan además los puntajes leídos de ese PDF, para
-- poder mostrar el resumen por materia y por mes. Ver "Calificaciones" en
-- CLAUDE.md.
--
-- 1) school_reports: un informe por hijo y por mes (unique). Cargar otra
--    vez el informe del mismo mes reemplaza sus puntajes.
-- 2) school_report_scores: una fila por materia. 0/0 (la materia no se
--    evaluó ese mes) no se guarda: el resumen lo muestra como "–".
--
-- Las dos por familia, RLS estándar (regla 5).

begin;

create table hogar.school_reports (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references hogar.families(id) on delete cascade,
  member_id     uuid not null references hogar.family_members(id) on delete cascade,
  -- El PDF original. Si se borra el documento, los puntajes quedan.
  document_id   uuid references hogar.documents(id) on delete set null,
  year          int  not null check (year between 2000 and 2100),
  month         int  not null check (month between 1 and 12),
  grade         text,          -- "2DO GRADO A", copia del informe
  late_arrivals int  check (late_arrivals >= 0),
  absences      int  check (absences >= 0),
  created_by    uuid references hogar.family_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (member_id, year, month)
);
create index on hogar.school_reports (family_id, member_id, year);

create table hogar.school_report_scores (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references hogar.families(id) on delete cascade,
  report_id    uuid not null references hogar.school_reports(id) on delete cascade,
  subject      text not null,
  sort_order   int  not null default 0,
  points       numeric(6,2) not null check (points >= 0),
  max_points   numeric(6,2) not null check (max_points > 0),
  observations text,
  check (points <= max_points),
  unique (report_id, subject)
);
create index on hogar.school_report_scores (report_id);

alter table hogar.school_reports enable row level security;
alter table hogar.school_report_scores enable row level security;

create policy "school_reports_select" on hogar.school_reports
  for select to authenticated using (family_id = hogar.current_family_id());
create policy "school_reports_insert" on hogar.school_reports
  for insert to authenticated with check (family_id = hogar.current_family_id());
create policy "school_reports_update" on hogar.school_reports
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());
create policy "school_reports_delete" on hogar.school_reports
  for delete to authenticated using (family_id = hogar.current_family_id());

create policy "school_report_scores_select" on hogar.school_report_scores
  for select to authenticated using (family_id = hogar.current_family_id());
create policy "school_report_scores_insert" on hogar.school_report_scores
  for insert to authenticated with check (family_id = hogar.current_family_id());
create policy "school_report_scores_update" on hogar.school_report_scores
  for update to authenticated
  using (family_id = hogar.current_family_id())
  with check (family_id = hogar.current_family_id());
create policy "school_report_scores_delete" on hogar.school_report_scores
  for delete to authenticated using (family_id = hogar.current_family_id());

create trigger school_reports_set_updated_at
  before update on hogar.school_reports
  for each row execute function hogar.set_updated_at();

-- Los default privileges de la 005 y la 007 ya lo cubren; explícito por
-- las dudas (reglas 10 y 12 de CLAUDE.md).
grant select, insert, update, delete on hogar.school_reports to authenticated;
grant select, insert, update, delete on hogar.school_report_scores to authenticated;
grant all on hogar.school_reports to service_role;
grant all on hogar.school_report_scores to service_role;

commit;
