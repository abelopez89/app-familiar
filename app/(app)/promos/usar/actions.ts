"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import type { Json } from "@/lib/supabase/types";
import { calcularDescuento, type DetalleUso } from "@/lib/promos/ahorro";
import { leerReferencia, opcionesParaUso, usoDeReferencia } from "@/lib/promos/usos";

export type UsoResult = { error?: string; success?: boolean };

const guardarSchema = z
  .object({
    compra: z.string().uuid().optional(),
    carga: z.string().uuid().optional(),
    promoId: z.string().uuid(),
    tarjetaId: z.string().uuid(),
    montoBruto: z.number().int().positive("Cargá el monto de la compra."),
    seleccion: z.array(z.number().int().min(0)).max(20),
  })
  .refine((v) => !!v.compra !== !!v.carga, "Falta la compra o la carga.");

/**
 * Registra (o reemplaza) la promo usada en una compra o carga. Nada de lo
 * que calcula el navegador se guarda: acá se vuelve a leer la promo, se
 * verifica que valía ese día para esa tarjeta y se recalcula con los usos
 * anteriores de la base. Cliente de sesión: `promo_usos` es de la familia.
 */
export async function guardarUsoPromo(input: unknown): Promise<UsoResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };
  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const datos = parsed.data;
  const familyId = context.family.id;

  const ref = await leerReferencia(familyId, { compra: datos.compra, carga: datos.carga });
  if (!ref) return { error: "No encontré la compra o la carga." };

  const opcion = (await opcionesParaUso(familyId, ref)).find(
    (o) => o.promoId === datos.promoId && o.tarjetaId === datos.tarjetaId,
  );
  if (!opcion) return { error: "Esa promo no valía ese día para esa tarjeta." };

  const existente = await usoDeReferencia(familyId, ref);
  const calculo = calcularDescuento({
    montoBruto: datos.montoBruto,
    componentes: opcion.componentes,
    seleccion: datos.seleccion,
    usosAnteriores: opcion.usosAnteriores,
    fecha: ref.fecha,
    excluirId: existente?.id,
  });
  const detalle: DetalleUso = { beneficio: opcion.beneficio, aplicados: calculo.aplicados };

  const fila = {
    promo_id: opcion.promoId,
    promo_titulo: opcion.titulo,
    banco: opcion.banco,
    tarjeta_id: opcion.tarjetaId,
    tarjeta_alias: opcion.tarjetaAlias,
    fecha: ref.fecha,
    monto_bruto: datos.montoBruto,
    descuento_caja: calculo.descuentoCaja,
    reintegro: calculo.reintegro,
    detalle: detalle as unknown as Json,
  };
  const supabase = await createClient();
  const { error } = existente
    ? await supabase
        .from("promo_usos")
        .update({ ...fila, reintegro_acreditado: existente.reintegro_acreditado && calculo.reintegro > 0 })
        .eq("id", existente.id)
        .eq("family_id", familyId)
    : await supabase.from("promo_usos").insert({
        ...fila,
        family_id: familyId,
        shopping_list_id: ref.tipo === "compra" ? ref.id : null,
        fuel_log_id: ref.tipo === "carga" ? ref.id : null,
        created_by: context.member.id,
      });
  if (error) {
    console.error("[guardarUsoPromo]", error);
    return { error: "No se pudo guardar la promo." };
  }

  revalidatePath(ref.volver);
  revalidatePath("/promos/ahorros");
  return { success: true };
}

export async function quitarUsoPromo(id: string): Promise<UsoResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Uso inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("promo_usos").delete().eq("id", id).eq("family_id", context.family.id);
  if (error) return { error: "No se pudo quitar la promo." };
  revalidatePath("/promos/ahorros");
  return { success: true };
}

export async function marcarReintegro(id: string, acreditado: boolean): Promise<UsoResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "Tu sesión venció. Volvé a entrar." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Uso inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("promo_usos")
    .update({ reintegro_acreditado: acreditado })
    .eq("id", id)
    .eq("family_id", context.family.id);
  if (error) return { error: "No se pudo actualizar el reintegro." };
  revalidatePath("/promos/ahorros");
  return { success: true };
}
