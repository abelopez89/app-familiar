import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { listActiveMembers as listActiveMembersService } from "@/lib/services/eventos";
import type { FamilyMember } from "@/lib/supabase/types";

/**
 * Miembros activos de la familia del usuario (la consulta vive en
 * `lib/services/eventos.ts`, compartida con el bot de Telegram).
 *
 * Vive acá y no dentro de `lib/events` o `lib/tasks` porque los dos
 * módulos la necesitaban y cada uno tenía su propia copia: con `cache()`
 * dos copias son dos consultas distintas en el mismo request, que es
 * exactamente lo que el inicio dispara al pintar el calendario y las
 * tareas juntos. Una sola definición, un solo viaje a la base.
 */
export const listActiveMembers = cache(async function listActiveMembers(): Promise<FamilyMember[]> {
  const context = await getCurrentFamilyContext();
  if (!context) return [];
  const supabase = await createClient();
  return listActiveMembersService(supabase, context.family.id);
});
