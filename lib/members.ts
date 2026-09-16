import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { FamilyMember } from "@/lib/supabase/types";

/**
 * Miembros activos de la familia (RLS filtra por family_id).
 *
 * Vive acá y no dentro de `lib/events` o `lib/tasks` porque los dos
 * módulos la necesitaban y cada uno tenía su propia copia: con `cache()`
 * dos copias son dos consultas distintas en el mismo request, que es
 * exactamente lo que el inicio dispara al pintar el calendario y las
 * tareas juntos. Una sola definición, un solo viaje a la base.
 */
export const listActiveMembers = cache(async function listActiveMembers(): Promise<FamilyMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("family_members")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return data ?? [];
});
