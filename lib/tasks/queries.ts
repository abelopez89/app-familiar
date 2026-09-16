import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
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
 * Todas las instancias pendientes de la familia (RLS filtra), con la
 * definición, el activo y el responsable ya resueltos — la usan la
 * pantalla /tareas y el bloque del dashboard, sin duplicar el join.
 */
export const listPendingInstancesWithDetails = cache(async function listPendingInstancesWithDetails(): Promise<TaskInstanceWithDetails[]> {
  const supabase = await createClient();

  const [instancesRes, definitionsRes, assetsRes, membersRes] = await Promise.all([
    supabase
      .from("task_instances")
      .select("*")
      .eq("status", "pendiente")
      .order("due_date", { ascending: true }),
    supabase.from("task_definitions").select("*"),
    supabase.from("assets").select("*"),
    supabase.from("family_members").select("*"),
  ]);

  if (instancesRes.error) throw instancesRes.error;

  const definitionsById = new Map((definitionsRes.data ?? []).map((d) => [d.id, d]));
  const assetsById = new Map((assetsRes.data ?? []).map((a) => [a.id, a]));
  const membersById = new Map((membersRes.data ?? []).map((m) => [m.id, m]));

  const result: TaskInstanceWithDetails[] = [];
  for (const instance of instancesRes.data ?? []) {
    const definition = definitionsById.get(instance.definition_id);
    if (!definition) continue;
    result.push({
      ...instance,
      definition,
      asset: definition.asset_id ? (assetsById.get(definition.asset_id) ?? null) : null,
      assignedTo: definition.assigned_to ? (membersById.get(definition.assigned_to) ?? null) : null,
    });
  }
  return result;
});
