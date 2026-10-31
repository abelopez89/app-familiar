"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFamilyContext } from "@/lib/family";
import { ingestaEnCurso } from "@/lib/promos/ingesta";
import { promoNormalizadaSchema } from "@/lib/promos/esquema";
import { filtrarPromo } from "@/lib/promos/filtrado";
import { actualizarPromo } from "@/lib/promos/persistencia";
import { ingestarItau } from "@/lib/promos/ingesta-itau";

export type ActionResult = { error?: string; success?: boolean };

const PRESUPUESTO_MS = 240_000;

/**
 * "Actualizar ahora" en `/promos`: la misma ingesta de Itaú que el cron
 * (`/api/cron/promos-itau`), disparada por un miembro con sesión. Usa el
 * admin client porque las tablas de promos no tienen escritura para
 * `authenticated` (son globales, migración 014); la sesión solo se exige
 * para que no la dispare cualquiera.
 *
 * Responde enseguida y trabaja en `after()`: la pantalla se refresca sola
 * mientras la ingesta figura en curso. El costo está acotado igual que en
 * el cron: solo se pide el detalle y se normaliza lo que cambió.
 */
export async function actualizarPromosAhora(): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };

  const db = createAdminClient();
  if (await ingestaEnCurso(db, "itau")) {
    return { error: "Ya se están actualizando. Esperá a que termine." };
  }

  after(async () => {
    const { ok, resumen } = await ingestarItau(db, PRESUPUESTO_MS);
    if (!ok) console.error("[promos] actualización manual con errores", resumen);
  });
  return { success: true };
}

/**
 * "Desactivar" en una promo de `/promos`: para una lectura equivocada
 * (sobre todo de los mails, que se guardan sin vista previa). No se
 * borra: queda `activa = false`. Las promos son globales, así que se
 * escribe con el admin client; la sesión solo se exige para que no lo
 * haga cualquiera. Una automática vuelve a activarse si el banco la
 * cambia (cambia su hash).
 */
export async function desactivarPromo(promoId: string): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };
  const id = z.string().uuid().safeParse(promoId);
  if (!id.success) return { error: "Promo inválida." };

  const { error } = await createAdminClient().from("promociones").update({ activa: false }).eq("id", id.data);
  if (error) {
    console.error("[desactivarPromo]", error);
    return { error: "No se pudo desactivar la promo." };
  }
  revalidatePath("/promos");
  revalidatePath("/promos/todas");
  return { success: true };
}

/** Vuelve a mostrar una promo desactivada (desde "Todas las promos"). */
export async function reactivarPromo(promoId: string): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };
  const id = z.string().uuid().safeParse(promoId);
  if (!id.success) return { error: "Promo inválida." };

  const { error } = await createAdminClient()
    .from("promociones")
    .update({ activa: true })
    .eq("id", id.data)
    .is("reemplazada_por", null);
  if (error) {
    console.error("[reactivarPromo]", error);
    return { error: "No se pudo reactivar la promo." };
  }
  revalidatePath("/promos");
  revalidatePath("/promos/todas");
  return { success: true };
}

const edicionSchema = z.object({ id: z.string().uuid(), promo: promoNormalizadaSchema });

/**
 * Guarda una promo corregida a mano (`/promos/[id]/editar`). Lo que llega
 * del navegador se vuelve a validar y pasa por el mismo `filtrarPromo`
 * que la ingesta y la carga manual: una corrección no puede dejar una
 * promo que el módulo no guardaría (otro rubro, sin descuento).
 */
export async function guardarEdicionPromo(input: unknown): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };
  const parsed = edicionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const filtrado = filtrarPromo(parsed.data.promo);
  if (!filtrado.ok) return { error: `No se puede guardar así: ${filtrado.motivo}.` };

  try {
    await actualizarPromo(createAdminClient(), parsed.data.id, filtrado.promos[0]);
  } catch (error) {
    console.error("[guardarEdicionPromo]", error);
    return { error: "No se pudo guardar. Si la promo quedó desactivada, reactivala desde Todas las promos." };
  }
  revalidatePath("/promos");
  revalidatePath("/promos/todas");
  return { success: true };
}
