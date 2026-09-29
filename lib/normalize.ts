/**
 * Normaliza un nombre de producto para comparar duplicados al combinar
 * plantillas: minúsculas, sin tildes, espacios repetidos colapsados.
 */
export function normalizeProductName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Categoría que se preselecciona al cargar un producto nuevo (en la lista
 * o en una plantilla): "Almacén", la más común en un súper. Se busca por
 * nombre normalizado porque las categorías son de cada familia y no hay
 * un id fijo. Si la familia no tiene una con ese nombre, "Sin categoría".
 */
export function defaultProductCategoryId(categories: { id: string; name: string }[]): string | null {
  return categories.find((c) => normalizeProductName(c.name) === "almacen")?.id ?? null;
}
