import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeProductName } from "@/lib/normalize";

/**
 * Nombres de producto conocidos por la familia: los que están en alguna
 * plantilla y los que se usaron alguna vez en una lista, para el
 * autocompletado al agregar un producto suelto.
 */
export async function getKnownProductNames(): Promise<string[]> {
  const supabase = await createClient();

  const [{ data: templateItems }, { data: listItems }] = await Promise.all([
    supabase.from("template_items").select("name"),
    supabase.from("shopping_list_items").select("name"),
  ]);

  const byNormalized = new Map<string, string>();
  for (const row of [...(templateItems ?? []), ...(listItems ?? [])]) {
    const key = normalizeProductName(row.name);
    if (!byNormalized.has(key)) byNormalized.set(key, row.name);
  }

  return Array.from(byNormalized.values()).sort((a, b) => a.localeCompare(b, "es"));
}
