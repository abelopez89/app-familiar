"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean; id?: string };

export async function updateItemQuantity(
  itemId: string,
  listId: string,
  quantity: number,
): Promise<ActionResult> {
  if (!(quantity > 0)) return { error: "La cantidad debe ser mayor a 0." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ quantity })
    .eq("id", itemId);

  if (error) return { error: "No se pudo actualizar la cantidad." };

  revalidatePath(`/compras/${listId}`);
  return { success: true };
}

export async function deleteListItem(itemId: string, listId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);

  if (error) return { error: "No se pudo eliminar el producto." };

  revalidatePath(`/compras/${listId}`);
  return { success: true };
}

const looseItemSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  category_id: z.string().uuid().nullable(),
  category_name: z.string().nullable(),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  unit: z.string().trim().min(1),
});

export async function addLooseItem(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const listId = formData.get("list_id");
  if (typeof listId !== "string" || !listId) return { error: "Lista inválida." };

  const categoryId = formData.get("category_id");
  const parsed = looseItemSchema.safeParse({
    name: formData.get("name"),
    category_id: categoryId && categoryId !== "none" ? categoryId : null,
    category_name: formData.get("category_name") || null,
    quantity: formData.get("quantity") || 1,
    unit: formData.get("unit") || "un",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("shopping_list_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("shopping_list_items")
    .insert({
      list_id: listId,
      family_id: context.family.id,
      name: parsed.data.name,
      category_id: parsed.data.category_id,
      category_name: parsed.data.category_name,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !created) return { error: "No se pudo agregar el producto." };

  revalidatePath(`/compras/${listId}`);
  return { success: true, id: created.id };
}

const addToTemplateSchema = z.object({
  template_id: z.string().uuid(),
  name: z.string().trim().min(1),
  category_id: z.string().uuid().nullable(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1),
});

export async function addItemToTemplate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const categoryId = formData.get("category_id");
  const parsed = addToTemplateSchema.safeParse({
    template_id: formData.get("template_id"),
    name: formData.get("name"),
    category_id: categoryId && categoryId !== "none" ? categoryId : null,
    quantity: formData.get("quantity") || 1,
    unit: formData.get("unit") || "un",
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
    .eq("template_id", parsed.data.template_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("template_items").insert({
    template_id: parsed.data.template_id,
    family_id: context.family.id,
    name: parsed.data.name,
    category_id: parsed.data.category_id,
    default_quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un producto con ese nombre en esa plantilla." };
    }
    return { error: "No se pudo agregar el producto a la plantilla." };
  }

  return { success: true };
}
