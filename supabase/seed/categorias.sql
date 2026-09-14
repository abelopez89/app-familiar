-- Seed de categorías típicas de un supermercado paraguayo, en orden de
-- recorrido razonable. Parametrizado por family_id: reemplazá el UUID
-- del bloque `do` de abajo por el id real de la familia antes de
-- ejecutarlo en el SQL Editor.

do $$
declare
  v_family_id uuid := '00000000-0000-0000-0000-000000000000'; -- reemplazar
begin
  insert into hogar.product_categories (family_id, name, sort_order) values
    (v_family_id, 'Verdulería', 1),
    (v_family_id, 'Panadería', 2),
    (v_family_id, 'Fiambrería', 3),
    (v_family_id, 'Carnicería', 4),
    (v_family_id, 'Lácteos', 5),
    (v_family_id, 'Almacén', 6),
    (v_family_id, 'Bebidas', 7),
    (v_family_id, 'Congelados', 8),
    (v_family_id, 'Limpieza', 9),
    (v_family_id, 'Perfumería', 10),
    (v_family_id, 'Mascotas', 11)
  on conflict (family_id, name) do nothing;
end $$;
