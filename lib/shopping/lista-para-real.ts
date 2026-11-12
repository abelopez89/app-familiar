import { normalizeProductName } from "@/lib/normalize";
import type { ProductoTienda, ShoppingListItem } from "@/lib/supabase/types";
import type { ProductoParaReal } from "@/lib/shopping/real";

/**
 * Los productos sin tildar de una lista, con el producto de Real que la
 * familia ya eligió para cada uno (por nombre normalizado, la misma clave
 * que `productos_tienda.producto_clave`). Un producto repetido en la lista
 * va una sola vez, con la mayor cantidad (mismo criterio que la
 * deduplicación de plantillas).
 */
export function productosParaReal(items: ShoppingListItem[], vinculados: ProductoTienda[]): ProductoParaReal[] {
  const porClave = new Map(vinculados.map((v) => [v.producto_clave, v]));
  const vistos = new Map<string, ProductoParaReal>();
  for (const item of items) {
    if (item.is_checked) continue;
    const clave = normalizeProductName(item.name);
    if (!clave) continue;
    const previo = vistos.get(clave);
    if (previo) {
      if (Number(item.quantity) > previo.cantidad) previo.cantidad = Number(item.quantity);
      continue;
    }
    const v = porClave.get(clave);
    vistos.set(clave, {
      nombre: item.name,
      cantidad: Number(item.quantity),
      unidad: item.unit,
      ...(v ? { referencia: v.referencia, nombreTienda: v.nombre_tienda, unidadTienda: v.unidad } : {}),
    });
  }
  return [...vistos.values()];
}
