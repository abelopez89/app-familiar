import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { listPendingInstancesWithDetails as listPendingInstancesService } from "@/lib/services/tareas";
// Reexportada desde lib/members.ts para que haya una sola instancia
// memoizada por request (ver el comentario de ese archivo).
export { listActiveMembers } from "@/lib/members";
import type { Asset, FamilyMember, TaskDefinition, TaskInstance } from "@/lib/supabase/types";

export type TaskInstanceWithDetails = TaskInstance & {
  definition: TaskDefinition;
  asset: Asset | null;
  assignedTo: FamilyMember | null;
};

export const listAssets = cache(async function listAssets(): Promise<Asset[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return data ?? [];
});

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export const listTaskDefinitions = cache(async function listTaskDefinitions(): Promise<TaskDefinition[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_definitions")
    .select("*")
    .eq("is_active", true)
    .order("next_due_date", { ascending: true });
  return data ?? [];
});

export async function getTaskDefinition(id: string): Promise<TaskDefinition | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("task_definitions").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/**
 * Historial de instancias completadas u omitidas de una definición, más
 * recientes primero — se usa tanto en el detalle de la definición como
 * en la ficha del activo (costo acumulado).
 */
export async function listTaskHistory(definitionId: string): Promise<TaskInstance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_instances")
    .select("*")
    .eq("definition_id", definitionId)
    .neq("status", "pendiente")
    .order("due_date", { ascending: false });
  return data ?? [];
}

export async function listTaskHistoryByAsset(assetId: string): Promise<TaskInstance[]> {
  const supabase = await createClient();
  const { data: definitions } = await supabase
    .from("task_definitions")
    .select("id")
    .eq("asset_id", assetId);

  const definitionIds = (definitions ?? []).map((d) => d.id);
  if (definitionIds.length === 0) return [];

  const { data } = await supabase
    .from("task_instances")
    .select("*")
    .in("definition_id", definitionIds)
    .neq("status", "pendiente")
    .order("due_date", { ascending: false });
  return data ?? [];
}

/**
 * Todas las instancias pendientes de la familia, con la definición, el
 * activo y el responsable ya resueltos — la usan la pantalla /tareas y el
 * bloque del dashboard, sin duplicar el join. La consulta vive en
 * `lib/services/tareas.ts` (compartida con el bot de Telegram).
 */
export const listPendingInstancesWithDetails = cache(async function listPendingInstancesWithDetails(): Promise<TaskInstanceWithDetails[]> {
  const context = await getCurrentFamilyContext();
  if (!context) return [];
  const supabase = await createClient();
  return listPendingInstancesService(supabase, context.family.id);
});
