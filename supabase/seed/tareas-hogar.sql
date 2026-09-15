-- Seed de activos y tareas de mantenimiento típicas de un hogar
-- (heladera, lavarropas, aire acondicionado, termotanque, microondas,
-- aspiradora), con intervalos habituales. Parametrizado por family_id:
-- reemplazá el UUID del bloque `do` de abajo por el id real de la
-- familia antes de ejecutarlo en el SQL Editor. Adaptalo a tus equipos
-- reales (marca, modelo, ubicación, fecha de compra) antes de correrlo.

do $$
declare
  v_family_id uuid := '00000000-0000-0000-0000-000000000000'; -- reemplazar
  v_heladera uuid;
  v_lavarropas uuid;
  v_aire uuid;
  v_termotanque uuid;
  v_microondas uuid;
  v_aspiradora uuid;
begin
  insert into hogar.assets (family_id, name, asset_type) values
    (v_family_id, 'Heladera', 'electrodomestico')
    returning id into v_heladera;
  insert into hogar.assets (family_id, name, asset_type) values
    (v_family_id, 'Lavarropas', 'electrodomestico')
    returning id into v_lavarropas;
  insert into hogar.assets (family_id, name, asset_type) values
    (v_family_id, 'Aire acondicionado', 'instalacion')
    returning id into v_aire;
  insert into hogar.assets (family_id, name, asset_type) values
    (v_family_id, 'Termotanque', 'instalacion')
    returning id into v_termotanque;
  insert into hogar.assets (family_id, name, asset_type) values
    (v_family_id, 'Microondas', 'electrodomestico')
    returning id into v_microondas;
  insert into hogar.assets (family_id, name, asset_type) values
    (v_family_id, 'Aspiradora', 'electrodomestico')
    returning id into v_aspiradora;

  insert into hogar.task_definitions
    (family_id, title, asset_id, recurrence_every, recurrence_unit, recurrence_anchor, next_due_date, lead_days)
  values
    (v_family_id, 'Limpiar serpentina y desagote de la heladera', v_heladera, 6, 'months', 'completion', current_date + 30, 3),
    (v_family_id, 'Limpiar el filtro del lavarropas', v_lavarropas, 3, 'months', 'completion', current_date + 14, 2),
    (v_family_id, 'Service del aire acondicionado', v_aire, 6, 'months', 'completion', current_date + 30, 5),
    (v_family_id, 'Limpiar filtros del aire acondicionado', v_aire, 2, 'months', 'completion', current_date + 10, 2),
    (v_family_id, 'Revisión del termotanque', v_termotanque, 1, 'years', 'completion', current_date + 60, 7),
    (v_family_id, 'Limpiar el plato giratorio y el interior del microondas', v_microondas, 1, 'months', 'completion', current_date + 7, 1),
    (v_family_id, 'Cambiar o limpiar la bolsa/filtro de la aspiradora', v_aspiradora, 2, 'months', 'completion', current_date + 10, 2);
end $$;
