import "server-only";
import { dateOnlyToFamilyMidnightUtc, todayInFamilyTimezone } from "@/lib/dates";
import { computeNextDueDateOnComplete } from "@/lib/tasks/schedule";
import { fail, type Actor, type Db, type ServiceResult } from "@/lib/services/types";
import type { TaskInstanceWithDetails } from "@/lib/tasks/queries";
import type { TaskDefinition, TaskInstance } from "@/lib/supabase/types";

// Tareas del hogar, compartido entre la app (`/tareas`) y el bot (botón
// "Marcar hecha" de los avisos del cron, `/hoy`). Las reglas de
// recurrencia siguen en lib/tasks/schedule.ts, que no se tocó.

export type UndoCompleteState = {
  instanceId: string;
  definitionId: string;
  previousNextDueDate: string;
  previousIsActive: boolean;
};

/**
 * Marca una instancia como hecha y recalcula next_due_date en la
 * definición (o la desactiva si era una tarea única). Devuelve el estado
 * previo de la definición para poder deshacer, y la definición (para que
 * quien llama sepa qué revalidar o qué mostrar).
 */
export async function completeTaskInstance(
  db: Db,
  actor: Actor,
  instanceId: string,
  options: { completedAt?: string; notes?: string; cost?: number | null } = {},
): Promise<ServiceResult<{ undo: UndoCompleteState; definition: TaskDefinition; instance: TaskInstance }>> {
  const { data: instance } = await db
    .from("task_instances")
    .select("*")
    .eq("family_id", actor.familyId)
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance) return fail("Tarea no encontrada.");

  const { data: definition } = await db
    .from("task_definitions")
    .select("*")
    .eq("family_id", actor.familyId)
    .eq("id", instance.definition_id)
    .maybeSingle();
  if (!definition) return fail("Definición no encontrada.");

  const today = todayInFamilyTimezone();
  const completedAtDate = options.completedAt ?? today;

  const nextDueDate = computeNextDueDateOnComplete(definition, completedAtDate, instance.due_date, today);

  const { error: instanceError } = await db
    .from("task_instances")
    .update({
      status: "hecha",
      completed_at: dateOnlyToFamilyMidnightUtc(completedAtDate).toISOString(),
      completed_by: actor.memberId,
      notes: options.notes ?? null,
      cost: options.cost ?? null,
    })
    .eq("family_id", actor.familyId)
    .eq("id", instanceId);

  if (instanceError) return fail("No se pudo completar la tarea.");

  if (nextDueDate === null) {
    await db.from("task_definitions").update({ is_active: false }).eq("family_id", actor.familyId).eq("id", definition.id);
  } else {
    await db
      .from("task_definitions")
      .update({ next_due_date: nextDueDate })
      .eq("family_id", actor.familyId)
      .eq("id", definition.id);
  }

  return {
    ok: true,
    definition,
    instance,
    undo: {
      instanceId,
      definitionId: definition.id,
      previousNextDueDate: definition.next_due_date,
      previousIsActive: definition.is_active,
    },
  };
}

/**
 * Instancias pendientes de la familia con definición, activo y
 * responsable ya resueltos — la usan `/tareas`, el inicio y el bot.
 */
export async function listPendingInstancesWithDetails(db: Db, familyId: string): Promise<TaskInstanceWithDetails[]> {
  const [instancesRes, definitionsRes, assetsRes, membersRes] = await Promise.all([
    db
      .from("task_instances")
      .select("*")
      .eq("family_id", familyId)
      .eq("status", "pendiente")
      .order("due_date", { ascending: true }),
    db.from("task_definitions").select("*").eq("family_id", familyId),
    db.from("assets").select("*").eq("family_id", familyId),
    db.from("family_members").select("*").eq("family_id", familyId),
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
}

export async function getTaskInstance(db: Db, familyId: string, instanceId: string): Promise<TaskInstance | null> {
  const { data } = await db
    .from("task_instances")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", instanceId)
    .maybeSingle();
  return data;
}
