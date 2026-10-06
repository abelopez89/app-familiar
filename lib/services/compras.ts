import "server-only";
import { normalizeProductName, defaultProductCategoryId } from "@/lib/normalize";
import { todayInFamilyTimezone } from "@/lib/dates";
import { fail, type Actor, type Db, type ServiceResult } from "@/lib/services/types";
import type { ProductCategory, ShoppingList, ShoppingListItem, ShoppingTemplate } from "@/lib/supabase/types";

// Lógica de compras compartida entre las Server Actions y el bot de
// Telegram (ver lib/services/types.ts). Mismas reglas de la Fase 1:
// snapshot de nombre y categoría, deduplicación por nombre normalizado.
// Toda consulta filtra por `family_id` a mano: con el admin client es la
// única barrera entre familias.

/** La lista abierta (o en curso) más reciente de la familia. */
export async function getOpenList(db: Db, familyId: string): Promise<ShoppingList | null> {
  const { data } = await db
    .from("shopping_lists")
    .select("*")
    .eq("family_id", familyId)
    .in("status", ["abierta", "en_curso"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getList(db: Db, familyId: string, listId: string): Promise<ShoppingList | null> {
  const { data } = await db
    .from("shopping_lists")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", listId)
    .maybeSingle();
  return data;
}

export async function listItems(db: Db, familyId: string, listId: string): Promise<ShoppingListItem[]> {
  const { data } = await db
    .from("shopping_list_items")
    .select("*")
    .eq("family_id", familyId)
    .eq("list_id", listId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function getItem(db: Db, familyId: string, itemId: string): Promise<ShoppingListItem | null> {
  const { data } = await db
    .from("shopping_list_items")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", itemId)
    .maybeSingle();
  return data;
}

/** Categorías en el orden del recorrido del súper (`sort_order`). */
export async function listProductCategories(db: Db, familyId: string): Promise<ProductCategory[]> {
  const { data } = await db
    .from("product_categories")
    .select("*")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function listTemplates(db: Db, familyId: string): Promise<ShoppingTemplate[]> {
  const { data } = await db
    .from("shopping_templates")
    .select("*")
    .eq("family_id", familyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

export async function listTemplateItemIds(db: Db, familyId: string, templateId: string): Promise<string[]> {
  const { data } = await db
    .from("template_items")
    .select("id")
    .eq("family_id", familyId)
    .eq("template_id", templateId);
  return (data ?? []).map((i) => i.id);
}

/**
 * Crea una lista a partir de los productos elegidos de las plantillas, o
 * vacía si no se eligió ninguno. Deduplica por nombre normalizado
 * quedándose con la mayor `default_quantity`, y copia nombre y categoría
 * (snapshot, no join — ver CLAUDE.md, Fase 1).
 */
export async function createList(
  db: Db,
  actor: Actor,
  input: { templateIds: string[]; itemIds: string[] },
): Promise<ServiceResult<{ listId: string }>> {
  const { data: items, error: itemsError } = input.itemIds.length
    ? await db.from("template_items").select("*").eq("family_id", actor.familyId).in("id", input.itemIds)
    : { data: [], error: null };

  if (itemsError || !items) return fail("No se pudieron cargar los productos.");

  const categoryIds = Array.from(
    new Set(items.map((i) => i.category_id).filter((id): id is string => id !== null)),
  );
  const { data: categories } = categoryIds.length
    ? await db
        .from("product_categories")
        .select("id, name")
        .eq("family_id", actor.familyId)
        .in("id", categoryIds)
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

  const { data: list, error: listError } = await db
    .from("shopping_lists")
    .insert({
      family_id: actor.familyId,
      shopping_date: todayInFamilyTimezone(),
      status: "abierta",
      // Solo las plantillas de las que efectivamente salió algún producto.
      source_template_ids: dedupedItems.length ? input.templateIds : null,
      created_by: actor.memberId,
    })
    .select("id")
    .single();

  if (listError || !list) return fail("No se pudo crear la lista.");

  if (dedupedItems.length === 0) return { ok: true, listId: list.id };

  const { error: insertError } = await db.from("shopping_list_items").insert(
    dedupedItems.map((item, index) => ({
      list_id: list.id,
      family_id: actor.familyId,
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

  if (insertError) return fail("No se pudo crear la lista.");

  return { ok: true, listId: list.id };
}

/**
 * Tilda o destilda un producto. Lo usan el modo supermercado (update
 * optimista) y el bot: es la misma fila, así que lo que se marca en un
 * lado se ve en el otro.
 */
export async function setItemChecked(
  db: Db,
  actor: Actor,
  itemId: string,
  isChecked: boolean,
): Promise<ServiceResult<{ item: ShoppingListItem }>> {
  const { data, error } = await db
    .from("shopping_list_items")
    .update({
      is_checked: isChecked,
      checked_at: isChecked ? new Date().toISOString() : null,
      checked_by: isChecked ? actor.memberId : null,
    })
    .eq("family_id", actor.familyId)
    .eq("id", itemId)
    .select("*")
    .maybeSingle();

  if (error || !data) return fail("No se pudo guardar el cambio.");
  return { ok: true, item: data };
}

/** Pasa la lista de "abierta" a "en curso" (no toca una ya en curso o cerrada). */
export async function markListInProgress(db: Db, familyId: string, listId: string): Promise<void> {
  await db
    .from("shopping_lists")
    .update({ status: "en_curso" })
    .eq("family_id", familyId)
    .eq("id", listId)
    .eq("status", "abierta");
}

export type LooseItemInput = {
  listId: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  quantity: number;
  unit: string;
};

/** Producto suelto en una lista. Nunca toca la plantilla (Fase 1, regla 1). */
export async function addLooseItem(
  db: Db,
  actor: Actor,
  input: LooseItemInput,
): Promise<ServiceResult<{ id: string }>> {
  const list = await getList(db, actor.familyId, input.listId);
  if (!list) return fail("No se pudo agregar el producto.");

  const { data: last } = await db
    .from("shopping_list_items")
    .select("sort_order")
    .eq("family_id", actor.familyId)
    .eq("list_id", input.listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await db
    .from("shopping_list_items")
    .insert({
      list_id: input.listId,
      family_id: actor.familyId,
      name: input.name,
      category_id: input.categoryId,
      category_name: input.categoryName,
      quantity: input.quantity,
      unit: input.unit,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !created) return fail("No se pudo agregar el producto.");
  return { ok: true, id: created.id };
}

/**
 * Categoría para productos escritos a mano (el bot no tiene selector): la
 * que ya tiene ese producto en alguna plantilla de la familia, por nombre
 * normalizado; si no está en ninguna, la de por defecto ("Almacén", misma
 * regla que el formulario de la app). Devuelve una función para poder
 * resolver varios productos con una sola consulta.
 */
export async function productCategoryGuesser(
  db: Db,
  familyId: string,
): Promise<(name: string) => ProductCategory | null> {
  const [categories, { data: known }] = await Promise.all([
    listProductCategories(db, familyId),
    db
      .from("template_items")
      .select("name, category_id")
      .eq("family_id", familyId)
      .not("category_id", "is", null),
  ]);
  const byName = new Map<string, string>();
  for (const item of known ?? []) {
    const key = normalizeProductName(item.name);
    if (item.category_id && !byName.has(key)) byName.set(key, item.category_id);
  }
  const fallback = defaultProductCategoryId(categories);
  return (name) => {
    const categoryId = byName.get(normalizeProductName(name)) ?? fallback;
    return categories.find((c) => c.id === categoryId) ?? null;
  };
}
