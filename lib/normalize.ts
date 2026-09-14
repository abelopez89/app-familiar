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
