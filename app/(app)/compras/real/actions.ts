"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import {
  guardarProductosTienda,
  productosElegidosSchema,
  quitarProductoTienda,
} from "@/lib/shopping/productos-tienda";

export type ResultadoProductosReal = { error?: string; guardados?: number };

/**
 * Guarda los productos de Real que la persona eligió en el marcador. Llega
 * lo que la página leyó del fragmento de la URL: se valida entero acá, sin
 * confiar en el navegador (cualquiera puede armar ese link).
 */
export async function guardarProductosReal(datos: unknown): Promise<ResultadoProductosReal> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const parsed = productosElegidosSchema.safeParse(datos);
  if (!parsed.success) return { error: "Los datos que llegaron del marcador no son válidos." };

  const supabase = await createClient();
  const resultado = await guardarProductosTienda(
    supabase,
    { familyId: context.family.id, memberId: context.member.id },
    "real",
    parsed.data.productos,
  );
  if (resultado.error) return { error: resultado.error };
  revalidatePath("/compras/real");
  return { guardados: resultado.guardados };
}

export async function quitarProductoReal(id: string): Promise<ResultadoProductosReal> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const resultado = await quitarProductoTienda(supabase, context.family.id, id);
  if (resultado.error) return { error: resultado.error };
  revalidatePath("/compras/real");
  return {};
}
