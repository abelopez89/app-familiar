"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean; id?: string };

const templateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  description: z.string().trim().optional(),
});

export async function createTemplate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_templates")
    .insert({
      family_id: context.family.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ya existe una plantilla con ese nombre." };
    return { error: "No se pudo crear la plantilla." };
  }

  revalidatePath("/compras/plantillas");
  return { success: true, id: data.id };
}

export async function renameTemplate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Plantilla inválida." };

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_templates")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar la plantilla." };

  revalidatePath("/compras/plantillas");
  revalidatePath(`/compras/plantillas/${id}`);
  return { success: true };
}

export async function setDefaultTemplate(id: string): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("shopping_templates")
    .update({ is_default: false })
    .eq("family_id", context.family.id);
  if (clearError) return { error: "No se pudo actualizar la plantilla por defecto." };

  const { error } = await supabase
    .from("shopping_templates")
    .update({ is_default: true })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar la plantilla por defecto." };

  revalidatePath("/compras/plantillas");
  return { success: true };
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_templates")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar la plantilla." };

  revalidatePath("/compras/plantillas");
  return { success: true };
}

export async function duplicateTemplate(id: string): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: original } = await supabase
    .from("shopping_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (!original) return { error: "No se encontró la plantilla." };

  const { data: items } = await supabase
    .from("template_items")
    .select("*")
    .eq("template_id", id);

  let newName = `${original.name} (copia)`;
  const { data: existing } = await supabase
    .from("shopping_templates")
    .select("name")
    .eq("family_id", context.family.id);
  const existingNames = new Set((existing ?? []).map((t) => t.name));
  let suffix = 2;
  while (existingNames.has(newName)) {
    newName = `${original.name} (copia ${suffix})`;
    suffix += 1;
  }

  const { data: created, error } = await supabase
    .from("shopping_templates")
    .insert({
      family_id: context.family.id,
      name: newName,
      description: original.description,
      icon: original.icon,
      is_default: false,
    })
    .select("id")
    .single();

  if (error || !created) return { error: "No se pudo duplicar la plantilla." };

  if (items && items.length > 0) {
    const { error: itemsError } = await supabase.from("template_items").insert(
      items.map((item) => ({
        template_id: created.id,
        family_id: context.family.id,
        name: item.name,
        category_id: item.category_id,
        default_quantity: item.default_quantity,
        unit: item.unit,
        is_staple: item.is_staple,
        notes: item.notes,
        sort_order: item.sort_order,
      })),
    );
    if (itemsError) return { error: "La plantilla se duplicó, pero fallaron los items." };
  }

  revalidatePath("/compras/plantillas");
  return { success: true, id: created.id };
}

const templateItemSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  category_id: z.string().uuid().nullable(),
  default_quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  unit: z.string().trim().min(1),
  is_staple: z.coerce.boolean(),
  notes: z.string().trim().optional(),
});

export async function createTemplateItem(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const templateId = formData.get("template_id");
  if (typeof templateId !== "string" || !templateId) return { error: "Plantilla inválida." };

  const categoryId = formData.get("category_id");
  const parsed = templateItemSchema.safeParse({
    name: formData.get("name"),
    category_id: categoryId && categoryId !== "none" ? categoryId : null,
    default_quantity: formData.get("default_quantity") || 1,
    unit: formData.get("unit") || "un",
    is_staple: formData.get("is_staple") === "on",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("template_items")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("template_items").insert({
    template_id: templateId,
    family_id: context.family.id,
    name: parsed.data.name,
    category_id: parsed.data.category_id,
    default_quantity: parsed.data.default_quantity,
    unit: parsed.data.unit,
    is_staple: parsed.data.is_staple,
    notes: parsed.data.notes || null,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un producto con ese nombre en esta plantilla." };
    return { error: "No se pudo agregar el producto." };
  }

  revalidatePath(`/compras/plantillas/${templateId}`);
  return { success: true };
}

export async function updateTemplateItem(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  const templateId = formData.get("template_id");
  if (typeof id !== "string" || !id || typeof templateId !== "string") {
    return { error: "Producto inválido." };
  }

  const categoryId = formData.get("category_id");
  const parsed = templateItemSchema.safeParse({
    name: formData.get("name"),
    category_id: categoryId && categoryId !== "none" ? categoryId : null,
    default_quantity: formData.get("default_quantity") || 1,
    unit: formData.get("unit") || "un",
    is_staple: formData.get("is_staple") === "on",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("template_items")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.category_id,
      default_quantity: parsed.data.default_quantity,
      unit: parsed.data.unit,
      is_staple: parsed.data.is_staple,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un producto con ese nombre en esta plantilla." };
    return { error: "No se pudo actualizar el producto." };
  }

  revalidatePath(`/compras/plantillas/${templateId}`);
  return { success: true };
}

export async function deleteTemplateItem(id: string, templateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("template_items").delete().eq("id", id);

  if (error) return { error: "No se pudo eliminar el producto." };

  revalidatePath(`/compras/plantillas/${templateId}`);
  return { success: true };
}

export async function reorderTemplateItems(
  templateId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();

  const updates = orderedIds.map((id, index) =>
    supabase.from("template_items").update({ sort_order: index }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) return { error: "No se pudo guardar el nuevo orden." };

  revalidatePath(`/compras/plantillas/${templateId}`);
  return { success: true };
}

export async function moveOrCopyTemplateItem(
  itemId: string,
  targetTemplateId: string,
  mode: "move" | "copy",
): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("template_items")
    .select("*")
    .eq("id", itemId)
    .single();
  if (!item) return { error: "No se encontró el producto." };

  if (mode === "move") {
    const { error } = await supabase
      .from("template_items")
      .update({ template_id: targetTemplateId })
      .eq("id", itemId);
    if (error) {
      if (error.code === "23505") return { error: "Ya existe un producto con ese nombre en la plantilla destino." };
      return { error: "No se pudo mover el producto." };
    }
  } else {
    const { error } = await supabase.from("template_items").insert({
      template_id: targetTemplateId,
      family_id: context.family.id,
      name: item.name,
      category_id: item.category_id,
      default_quantity: item.default_quantity,
      unit: item.unit,
      is_staple: item.is_staple,
      notes: item.notes,
      sort_order: item.sort_order,
    });
    if (error) {
      if (error.code === "23505") return { error: "Ya existe un producto con ese nombre en la plantilla destino." };
      return { error: "No se pudo copiar el producto." };
    }
  }

  revalidatePath(`/compras/plantillas/${item.template_id}`);
  revalidatePath(`/compras/plantillas/${targetTemplateId}`);
  return { success: true };
}
