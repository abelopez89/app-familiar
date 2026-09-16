import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ShoppingList } from "@/lib/supabase/types";

export const getOpenShoppingList = cache(async function getOpenShoppingList(): Promise<ShoppingList | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("shopping_lists")
    .select("*")
    .in("status", ["abierta", "en_curso"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
});
