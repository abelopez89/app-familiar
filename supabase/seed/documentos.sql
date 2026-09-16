-- Seed de categorías iniciales para el Centro de Documentos (Fase 5).
-- Parametrizado por family_id: reemplazá el UUID del bloque `do` de abajo
-- por el id real de la familia antes de ejecutarlo en el SQL Editor.

do $$
declare
  v_family_id uuid := '00000000-0000-0000-0000-000000000000'; -- reemplazar
begin
  insert into hogar.document_categories (family_id, name, kind, sort_order) values
    (v_family_id, 'Personales', 'personal', 1),
    (v_family_id, 'Médicos', 'medico', 2),
    (v_family_id, 'Vehículo', 'vehiculo', 3),
    (v_family_id, 'Hogar', 'hogar', 4),
    (v_family_id, 'Educación', 'educacion', 5)
  on conflict (family_id, name) do nothing;
end $$;
