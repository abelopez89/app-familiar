import "server-only";
import { z } from "zod";
import { normalizeProductName } from "@/lib/normalize";
import type { Db } from "@/lib/services/types";
import type { ProductoTienda, TiendaProducto } from "@/lib/supabase/types";

/**
 * Productos de las tiendas online vinculados a los productos de las listas
 * (migración 017). La app no le habla a la tienda: guarda lo que la
 * persona eligió en el marcador, en su navegador. Cada consulta filtra por
 * `family_id` aunque RLS ya lo haga (regla 3 de la Fase 7).
 */

export const MAX_PRODUCTOS_POR_GUARDADO = 300;

const texto = (max: number) => z.string().trim().min(1).max(max);

export const productosElegidosSchema = z.object({
  v: z.literal(1),
  productos: z
    .array(
      z.object({
        nombre: texto(200),
        // Real usa códigos numéricos; se acepta lo que podría ser un SKU y nada más.
        referencia: texto(64).regex(/^[A-Za-z0-9._-]+$/),
        nombreTienda: texto(300),
        unidad: texto(20),
      }),
    )
    .min(1)
    .max(MAX_PRODUCTOS_POR_GUARDADO),
});

export async function listarProductosTienda(db: Db, familyId: string, tienda: TiendaProducto): Promise<ProductoTienda[]> {
  const { data, error } = await db
    .from("productos_tienda")
    .select("*")
    .eq("family_id", familyId)
    .eq("tienda", tienda)
    .order("producto_clave");
  if (error) throw new Error(`No se pudieron leer los productos de la tienda: ${error.message}`);
  return data ?? [];
}

/**
 * Guarda (o reemplaza) el producto de la tienda de cada producto de la
 * lista. La clave se recalcula acá con `normalizeProductName`: no se
 * confía en la que pudiera mandar el navegador. Si el mismo producto viene
 * dos veces, gana el último.
 */
export async function guardarProductosTienda(
  db: Db,
  actor: { familyId: string; memberId: string },
  tienda: TiendaProducto,
  productos: z.infer<typeof productosElegidosSchema>["productos"],
): Promise<{ error?: string; guardados?: number }> {
  const porClave = new Map<string, (typeof productos)[number]>();
  for (const p of productos) {
    const clave = normalizeProductName(p.nombre);
    if (clave) porClave.set(clave, p);
  }
  const filas = [...porClave.entries()].map(([clave, p]) => ({
    family_id: actor.familyId,
    tienda,
    producto_clave: clave,
    producto_nombre: p.nombre,
    referencia: p.referencia,
    nombre_tienda: p.nombreTienda,
    unidad: p.unidad,
    created_by: actor.memberId,
  }));
  if (filas.length === 0) return { error: "No había productos para guardar." };

  const { error } = await db
    .from("productos_tienda")
    .upsert(filas, { onConflict: "family_id,tienda,producto_clave" });
  if (error) return { error: "No se pudieron guardar los productos." };
  return { guardados: filas.length };
}

export async function quitarProductoTienda(db: Db, familyId: string, id: string): Promise<{ error?: string }> {
  const { error } = await db.from("productos_tienda").delete().eq("family_id", familyId).eq("id", id);
  if (error) return { error: "No se pudo quitar el producto." };
  return {};
}
