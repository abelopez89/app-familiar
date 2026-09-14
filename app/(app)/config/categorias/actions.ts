"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import type { ActionResult } from "../actions";

const nameSchema = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío."),
});

export async function createCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("product_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("product_categories").insert({
    family_id: context.family.id,
    name: parsed.data.name,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una categoría con ese nombre." };
    }
    return { error: "No se pudo crear la categoría." };
  }

  revalidatePath("/config/categorias");
  return { success: true };
}

export async function renameCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Categoría inválida." };

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_categories")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una categoría con ese nombre." };
    }
    return { error: "No se pudo renombrar la categoría." };
  }

  revalidatePath("/config/categorias");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").delete().eq("id", id);

  if (error) return { error: "No se pudo eliminar la categoría." };

  revalidatePath("/config/categorias");
  return { success: true };
}

export async function reorderCategories(orderedIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();

  const updates = orderedIds.map((id, index) =>
    supabase.from("product_categories").update({ sort_order: index }).eq("id", id),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) return { error: "No se pudo guardar el nuevo orden." };

  revalidatePath("/config/categorias");
  return { success: true };
}
