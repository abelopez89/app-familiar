"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { normalizarAfinidad, normalizarNivel } from "@/lib/promos/normalize";

export type ActionResult = { error?: string; success?: boolean };

/**
 * Sin números de tarjeta, a propósito: para el matching alcanzan banco,
 * marca, nivel, afinidad y tipo; el alias es para reconocerla en los avisos.
 * Nivel y afinidad se guardan normalizados (minúsculas, sin tildes,
 * sinónimos resueltos) para compararlos contra las reglas de las promos.
 */
const cardSchema = z.object({
  member_id: z.string().uuid("Elegí de quién es la tarjeta."),
  banco: z.enum(["gnb", "itau", "sudameris", "basa"], { error: "Elegí el banco." }),
  marca: z.enum(["visa", "mastercard", "amex"], { error: "Elegí la marca." }),
  nivel: z.string().trim().min(1, "Elegí el nivel."),
  afinidad: z.string().trim().optional(),
  tipo: z.enum(["credito", "debito", "prepaga"]),
  alias: z.string().trim().min(1, "Poné un alias para reconocerla.").max(60),
  activa: z.boolean(),
});

function parseCardForm(formData: FormData) {
  const parsed = cardSchema.safeParse({
    member_id: formData.get("member_id") ?? "",
    banco: formData.get("banco") ?? "",
    marca: formData.get("marca") ?? "",
    nivel: formData.get("nivel") ?? "",
    afinidad: formData.get("afinidad") ?? "",
    tipo: formData.get("tipo") ?? "credito",
    alias: formData.get("alias") ?? "",
    activa: formData.get("activa") !== "false",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }
  const nivel = normalizarNivel(parsed.data.nivel);
  if (!nivel) return { error: "Elegí el nivel." } as const;
  return {
    data: { ...parsed.data, nivel, afinidad: normalizarAfinidad(parsed.data.afinidad) },
  } as const;
}

export async function createCard(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseCardForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { error } = await supabase.from("tarjetas_familia").insert({
    family_id: context.family.id,
    ...parsed.data,
  });

  if (error) return { error: "No se pudo guardar la tarjeta." };

  revalidatePath("/config/tarjetas");
  return { success: true };
}

export async function updateCard(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Tarjeta inválida." };

  const parsed = parseCardForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tarjetas_familia")
    .update(parsed.data)
    .eq("id", id)
    .eq("family_id", context.family.id);

  if (error) return { error: "No se pudo actualizar la tarjeta." };

  revalidatePath("/config/tarjetas");
  return { success: true };
}

/** Borrado real: nada apunta a una tarjeta (las promos son del banco). */
export async function deleteCard(id: string): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tarjetas_familia")
    .delete()
    .eq("id", id)
    .eq("family_id", context.family.id);

  if (error) return { error: "No se pudo eliminar la tarjeta." };

  revalidatePath("/config/tarjetas");
  return { success: true };
}
