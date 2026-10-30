"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFamilyContext } from "@/lib/family";
import { probarItau } from "@/lib/promos/prueba-itau";

export type ActionResult = { ok?: boolean; mensaje?: string; error?: string };

/**
 * Prueba de conexión con Itaú (antes de la Fase 3, ver
 * `lib/promos/prueba-itau.ts`). Exige sesión; usa el admin client porque
 * `promo_ingestas` no tiene escritura para `authenticated`. Son dos
 * pedidos y sin Claude, así que se espera el resultado y se muestra.
 */
export async function probarConexionItau(): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };

  const resultado = await probarItau(createAdminClient());
  revalidatePath("/promos");
  return resultado;
}
