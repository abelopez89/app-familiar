"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { SUGGESTED_CATEGORIES } from "@/lib/expenses/constants";

export type ActionResult = { error?: string; success?: boolean };

const categorySchema = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío."),
  icon: z.string().trim().optional(),
});

function revalidate() {
  revalidatePath("/config/gastos");
  revalidatePath("/gastos", "layout");
}

export async function createExpenseCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({ name: formData.get("name"), icon: formData.get("icon") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("expense_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("expense_categories").insert({
    family_id: context.family.id,
    name: parsed.data.name,
    icon: parsed.data.icon || null,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) {
    if (error.code === "23505") return { error: "Ya existe una categoría con ese nombre." };
    return { error: "No se pudo crear la categoría." };
  }

  revalidate();
  return { success: true };
}

export async function updateExpenseCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Categoría inválida." };

  const parsed = categorySchema.safeParse({ name: formData.get("name"), icon: formData.get("icon") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({ name: parsed.data.name, icon: parsed.data.icon || null })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Ya existe una categoría con ese nombre." };
    return { error: "No se pudo actualizar la categoría." };
  }

  revalidate();
  return { success: true };
}

/** Ocultarla de los chips sin tocar los gastos que ya la usan. */
export async function setExpenseCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "No se pudo actualizar la categoría." };
  revalidate();
  return { success: true };
}

/** Los gastos que la usaban quedan sin categoría (`on delete set null`). */
export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la categoría." };
  revalidate();
  return { success: true };
}

/**
 * Agrega las categorías sugeridas que falten. La migración 011 las
 * sembró para las familias que existían; una familia creada después
 * arranca vacía y las trae desde acá.
 */
export async function addSuggestedExpenseCategories(): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("expense_categories").select("name, sort_order");
  const names = new Set((existing ?? []).map((c) => c.name.toLowerCase()));
  const maxOrder = (existing ?? []).reduce((acc, c) => Math.max(acc, c.sort_order), 0);
  const missing = SUGGESTED_CATEGORIES.filter((c) => !names.has(c.name.toLowerCase()));
  if (missing.length === 0) return { success: true };

  const { error } = await supabase.from("expense_categories").insert(
    missing.map((c, i) => ({ family_id: context.family.id, name: c.name, icon: c.icon, sort_order: maxOrder + i + 1 })),
  );
  if (error) return { error: "No se pudieron agregar las categorías." };

  revalidate();
  return { success: true };
}
