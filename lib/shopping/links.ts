import type { ShoppingList } from "@/lib/supabase/types";

/**
 * A dónde lleva tocar una lista abierta: con la compra ya en curso, directo
 * al modo supermercado (es lo que se busca a mitad del súper); si todavía
 * está abierta, a la edición de la lista. Una lista cerrada va a su resumen.
 */
export function shoppingListHref(list: Pick<ShoppingList, "id" | "status">): string {
  return list.status === "abierta" ? `/compras/${list.id}` : `/compras/${list.id}/comprar`;
}
