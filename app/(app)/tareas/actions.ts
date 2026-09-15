"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { dateOnlyToFamilyMidnightUtc, todayInFamilyTimezone } from "@/lib/dates";
import { computeNextDueDateOnComplete, computeNextDueDateOnSkip } from "@/lib/tasks/schedule";

export type ActionResult = { error?: string; success?: boolean };

export type UndoCompleteState = {
  instanceId: string;
  definitionId: string;
  previousNextDueDate: string;
  previousIsActive: boolean;
};

export type CompleteResult = ActionResult & { undo?: UndoCompleteState };

/**
 * Marca una instancia como hecha y recalcula next_due_date en la
 * definición (o la desactiva si era una tarea única). Devuelve el estado
 * previo de la definición para poder deshacer desde la UI (quick-complete
 * con toast de deshacer).
 */
export async function completeTaskInstance(
  instanceId: string,
  options: { completedAt?: string; notes?: string; cost?: number | null } = {},
): Promise<CompleteResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: instance } = await supabase
    .from("task_instances")
    .select("*")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance) return { error: "Tarea no encontrada." };

  const { data: definition } = await supabase
    .from("task_definitions")
    .select("*")
    .eq("id", instance.definition_id)
    .maybeSingle();
  if (!definition) return { error: "Definición no encontrada." };

  const today = todayInFamilyTimezone();
  const completedAtDate = options.completedAt ?? today;

  const nextDueDate = computeNextDueDateOnComplete(definition, completedAtDate, instance.due_date, today);

  const { error: instanceError } = await supabase
    .from("task_instances")
    .update({
      status: "hecha",
      completed_at: dateOnlyToFamilyMidnightUtc(completedAtDate).toISOString(),
      completed_by: context.member.id,
      notes: options.notes ?? null,
      cost: options.cost ?? null,
    })
    .eq("id", instanceId);

  if (instanceError) return { error: "No se pudo completar la tarea." };

  if (nextDueDate === null) {
    await supabase.from("task_definitions").update({ is_active: false }).eq("id", definition.id);
  } else {
    await supabase.from("task_definitions").update({ next_due_date: nextDueDate }).eq("id", definition.id);
  }

  revalidatePath("/tareas");
  revalidatePath("/");
  revalidatePath(`/tareas/definiciones/${definition.id}`);

  return {
    success: true,
    undo: {
      instanceId,
      definitionId: definition.id,
      previousNextDueDate: definition.next_due_date,
      previousIsActive: definition.is_active,
    },
  };
}

/**
 * Revierte completeTaskInstance: vuelve la instancia a pendiente y la
 * definición al next_due_date/is_active que tenía antes. Se usa desde el
 * toast de "deshacer" de la marca rápida como hecha.
 */
export async function undoCompleteTaskInstance(undo: UndoCompleteState): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: instanceError } = await supabase
    .from("task_instances")
    .update({ status: "pendiente", completed_at: null, completed_by: null, notes: null, cost: null })
    .eq("id", undo.instanceId);

  if (instanceError) return { error: "No se pudo deshacer." };

  await supabase
    .from("task_definitions")
    .update({ next_due_date: undo.previousNextDueDate, is_active: undo.previousIsActive })
    .eq("id", undo.definitionId);

  revalidatePath("/tareas");
  revalidatePath("/");
  revalidatePath(`/tareas/definiciones/${undo.definitionId}`);

  return { success: true };
}

/**
 * Omitir siempre recalcula con ancla `schedule`, sin importar el ancla
 * de la definición — ver lib/tasks/schedule.ts.
 */
export async function skipTaskInstance(instanceId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: instance } = await supabase
    .from("task_instances")
    .select("*")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance) return { error: "Tarea no encontrada." };

  const { data: definition } = await supabase
    .from("task_definitions")
    .select("*")
    .eq("id", instance.definition_id)
    .maybeSingle();
  if (!definition) return { error: "Definición no encontrada." };

  const today = todayInFamilyTimezone();
  const nextDueDate = computeNextDueDateOnSkip(definition, instance.due_date, today);

  const { error: instanceError } = await supabase
    .from("task_instances")
    .update({ status: "omitida" })
    .eq("id", instanceId);

  if (instanceError) return { error: "No se pudo omitir la tarea." };

  if (nextDueDate === null) {
    await supabase.from("task_definitions").update({ is_active: false }).eq("id", definition.id);
  } else {
    await supabase.from("task_definitions").update({ next_due_date: nextDueDate }).eq("id", definition.id);
  }

  revalidatePath("/tareas");
  revalidatePath("/");
  revalidatePath(`/tareas/definiciones/${definition.id}`);

  return { success: true };
}
