"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { normalizeProductName } from "@/lib/normalize";
import { todayInFamilyTimezone } from "@/lib/dates";

export type ActionResult = { error?: string };

const schema = z.object({
  templateIds: z.array(z.string().uuid()).min(1, "Elegí al menos una plantilla."),
  itemIds: z.array(z.string().uuid()),
});

export async function createShoppingListFromTemplates(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    templateIds: formData.getAll("templateId"),
    itemIds: formData.getAll("itemId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  if (parsed.data.itemIds.length === 0) {
    return { error: "Seleccioná al menos un producto." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: items, error: itemsError } = await supabase
    .from("template_items")
    .select("*")
    .in("id", parsed.data.itemIds);

  if (itemsError || !items) return { error: "No se pudieron cargar los productos." };

  const categoryIds = Array.from(
    new Set(items.map((i) => i.category_id).filter((id): id is string => id !== null)),
  );
  const { data: categories } = categoryIds.length
    ? await supabase.from("product_categories").select("id, name").in("id", categoryIds)
    : { data: [] as { id: string; name: string }[] };
  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  // Deduplicación por nombre normalizado, tomando la mayor default_quantity.
  const byNormalizedName = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const key = normalizeProductName(item.name);
    const existing = byNormalizedName.get(key);
    if (!existing || item.default_quantity > existing.default_quantity) {
      byNormalizedName.set(key, item);
    }
  }

  const dedupedItems = Array.from(byNormalizedName.values());

  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .insert({
      family_id: context.family.id,
      shopping_date: todayInFamilyTimezone(),
      status: "abierta",
      source_template_ids: parsed.data.templateIds,
      created_by: context.member.id,
    })
    .select("id")
    .single();

  if (listError || !list) return { error: "No se pudo crear la lista." };

  const { error: insertError } = await supabase.from("shopping_list_items").insert(
    dedupedItems.map((item, index) => ({
      list_id: list.id,
      family_id: context.family.id,
      template_item_id: item.id,
      name: item.name,
      category_id: item.category_id,
      category_name: item.category_id ? (categoryNameById.get(item.category_id) ?? null) : null,
      quantity: item.default_quantity,
      unit: item.unit,
      notes: item.notes,
      sort_order: index,
    })),
  );

  if (insertError) return { error: "No se pudo crear la lista." };

  redirect(`/compras/${list.id}`);
}
