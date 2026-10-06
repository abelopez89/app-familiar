import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { getOpenList } from "@/lib/services/compras";
import type { ShoppingList } from "@/lib/supabase/types";

export const getOpenShoppingList = cache(async function getOpenShoppingList(): Promise<ShoppingList | null> {
  const context = await getCurrentFamilyContext();
  if (!context) return null;
  const supabase = await createClient();
  return getOpenList(supabase, context.family.id);
});
