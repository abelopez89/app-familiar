"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFamilyContext } from "@/lib/family";
import { ingestaEnCurso } from "@/lib/promos/ingesta";
import { ingestarGnb } from "@/lib/promos/ingesta-gnb";

export type ActionResult = { error?: string; success?: boolean };

const PRESUPUESTO_MS = 240_000;

/**
 * "Actualizar ahora" en `/promos`: la misma ingesta que el cron
 * (`/api/cron/promos-gnb`), disparada por un miembro con sesión. Usa el
 * admin client porque las tablas de promos no tienen escritura para
 * `authenticated` (son globales, migración 014); la sesión solo se exige
 * para que no la dispare cualquiera.
 *
 * Responde enseguida y trabaja en `after()`: la pantalla se refresca sola
 * mientras la ingesta figura en curso. El costo está acotado igual que en
 * el cron: solo se normaliza lo que cambió de hash.
 */
export async function actualizarPromosAhora(): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };

  const db = createAdminClient();
  if (await ingestaEnCurso(db, "gnb")) {
    return { error: "Ya se están actualizando. Esperá a que termine." };
  }

  after(async () => {
    const { ok, resumen } = await ingestarGnb(db, PRESUPUESTO_MS);
    if (!ok) console.error("[promos] actualización manual con errores", resumen);
  });
  return { success: true };
}
