"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean };

const categorySchema = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío."),
  kind: z.enum(["personal", "medico", "vehiculo", "hogar", "educacion", "general"]),
});

export async function createDocumentCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "general",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("document_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("document_categories").insert({
    family_id: context.family.id,
    name: parsed.data.name,
    kind: parsed.data.kind,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ya existe una categoría con ese nombre." };
    return { error: "No se pudo crear la categoría." };
  }

  revalidatePath("/config/documentos");
  return { success: true };
}

export async function updateDocumentCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Categoría inválida." };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "general",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("document_categories")
    .update({ name: parsed.data.name, kind: parsed.data.kind })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Ya existe una categoría con ese nombre." };
    return { error: "No se pudo actualizar la categoría." };
  }

  revalidatePath("/config/documentos");
  return { success: true };
}

export async function deleteDocumentCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("document_categories").delete().eq("id", id);

  if (error) return { error: "No se pudo eliminar la categoría." };

  revalidatePath("/config/documentos");
  return { success: true };
}
