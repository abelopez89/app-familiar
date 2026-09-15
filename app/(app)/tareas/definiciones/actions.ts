"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean; id?: string };

const definitionSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio."),
  description: z.string().trim().optional(),
  asset_id: z.string().uuid().nullable(),
  assigned_to: z.string().uuid().nullable(),
  recurrence_every: z.coerce.number().int().positive().optional(),
  recurrence_unit: z.enum(["days", "weeks", "months", "years"]).optional(),
  recurrence_anchor: z.enum(["completion", "schedule"]),
  next_due_date: z.string().trim().min(1, "La fecha de vencimiento es obligatoria."),
  lead_days: z.coerce.number().int().min(0),
  notify_telegram: z.coerce.boolean(),
});

function parseDefinitionForm(formData: FormData) {
  const assetId = formData.get("asset_id");
  const assignedTo = formData.get("assigned_to");
  const hasRecurrence = formData.get("has_recurrence") === "on";

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    asset_id: assetId && assetId !== "none" ? assetId : null,
    assigned_to: assignedTo && assignedTo !== "none" ? assignedTo : null,
    recurrence_every: hasRecurrence ? (formData.get("recurrence_every") ?? undefined) : undefined,
    recurrence_unit: hasRecurrence ? (formData.get("recurrence_unit") ?? undefined) : undefined,
    recurrence_anchor: formData.get("recurrence_anchor") ?? "completion",
    next_due_date: formData.get("next_due_date"),
    lead_days: formData.get("lead_days") || 2,
    notify_telegram: formData.get("notify_telegram") === "on",
  };

  const parsed = definitionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }

  if (hasRecurrence && (!parsed.data.recurrence_every || !parsed.data.recurrence_unit)) {
    return { error: "Indicá la cantidad y la unidad de la repetición." } as const;
  }

  return { data: parsed.data } as const;
}

export async function createTaskDefinition(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseDefinitionForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_definitions")
    .insert({
      family_id: context.family.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      asset_id: parsed.data.asset_id,
      assigned_to: parsed.data.assigned_to,
      recurrence_every: parsed.data.recurrence_every ?? null,
      recurrence_unit: parsed.data.recurrence_unit ?? null,
      recurrence_anchor: parsed.data.recurrence_anchor,
      next_due_date: parsed.data.next_due_date,
      lead_days: parsed.data.lead_days,
      notify_telegram: parsed.data.notify_telegram,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear la tarea." };

  revalidatePath("/tareas/definiciones");
  revalidatePath("/tareas");
  return { success: true, id: data.id };
}

export async function updateTaskDefinition(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Tarea inválida." };

  const parsed = parseDefinitionForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_definitions")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      asset_id: parsed.data.asset_id,
      assigned_to: parsed.data.assigned_to,
      recurrence_every: parsed.data.recurrence_every ?? null,
      recurrence_unit: parsed.data.recurrence_unit ?? null,
      recurrence_anchor: parsed.data.recurrence_anchor,
      next_due_date: parsed.data.next_due_date,
      lead_days: parsed.data.lead_days,
      notify_telegram: parsed.data.notify_telegram,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar la tarea." };

  revalidatePath("/tareas/definiciones");
  revalidatePath(`/tareas/definiciones/${id}`);
  revalidatePath("/tareas");
  return { success: true, id };
}

export async function deleteTaskDefinition(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("task_definitions").update({ is_active: false }).eq("id", id);

  if (error) return { error: "No se pudo eliminar la tarea." };

  revalidatePath("/tareas/definiciones");
  revalidatePath("/tareas");
  return { success: true };
}
