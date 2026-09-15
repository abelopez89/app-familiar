"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { dateOnlyToFamilyMidnightUtc, dateTimeToFamilyUtc } from "@/lib/dates";
import { REMINDER_PRESETS } from "@/lib/events/constants";

export type ActionResult = { error?: string; success?: boolean; id?: string };

const eventSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio."),
  date: z.string().trim().min(1, "La fecha es obligatoria."),
  all_day: z.coerce.boolean(),
  start_time: z.string().trim().optional(),
  end_time: z.string().trim().optional(),
  category: z.enum(["escolar", "medico", "familiar", "otro"], {
    message: "Categoría inválida.",
  }),
  location: z.string().trim().optional(),
  description: z.string().trim().optional(),
  recurrence: z.enum(["weekly", "monthly", "yearly", "none"]).default("none"),
  recurrence_until: z.string().trim().optional(),
  telegram: z.coerce.boolean(),
});

function parseEventForm(formData: FormData) {
  const raw = {
    title: formData.get("title"),
    date: formData.get("date"),
    all_day: formData.get("all_day") === "on",
    start_time: formData.get("start_time") ?? "",
    end_time: formData.get("end_time") ?? "",
    category: formData.get("category") ?? "familiar",
    location: formData.get("location") ?? "",
    description: formData.get("description") ?? "",
    recurrence: formData.get("recurrence") ?? "none",
    recurrence_until: formData.get("recurrence_until") ?? "",
    telegram: formData.get("telegram") === "on",
  };

  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }

  if (!parsed.data.all_day && !parsed.data.start_time) {
    return { error: "Indicá una hora o marcá \"todo el día\"." } as const;
  }

  const participant_ids = formData
    .getAll("participant_ids")
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  const reminderMinutes = formData
    .getAll("reminder_minutes")
    .map((v) => Number(v))
    .filter((n) => REMINDER_PRESETS.some((p) => p.minutes === n));

  return { data: parsed.data, participant_ids, reminderMinutes } as const;
}

export async function createEvent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const { data, participant_ids, reminderMinutes } = parsed;

  const starts_at = data.all_day
    ? dateOnlyToFamilyMidnightUtc(data.date)
    : dateTimeToFamilyUtc(data.date, data.start_time!);

  const ends_at =
    !data.all_day && data.end_time
      ? dateTimeToFamilyUtc(data.date, data.end_time)
      : null;

  const recurrence = data.recurrence === "none" ? null : data.recurrence;
  const recurrence_until =
    recurrence && data.recurrence_until ? data.recurrence_until : null;

  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      family_id: context.family.id,
      title: data.title,
      description: data.description || null,
      category: data.category,
      starts_at: starts_at.toISOString(),
      ends_at: ends_at ? ends_at.toISOString() : null,
      all_day: data.all_day,
      location: data.location || null,
      recurrence,
      recurrence_until,
      created_by: context.member.id,
    })
    .select("id")
    .single();

  if (error || !event) return { error: "No se pudo crear el evento." };

  await saveParticipantsAndReminders(
    event.id,
    context.family.id,
    participant_ids,
    reminderMinutes,
    data.telegram,
  );

  revalidatePath("/eventos");
  revalidatePath("/");
  return { success: true, id: event.id };
}

export async function updateEvent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Evento inválido." };

  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, participant_ids, reminderMinutes } = parsed;

  const starts_at = data.all_day
    ? dateOnlyToFamilyMidnightUtc(data.date)
    : dateTimeToFamilyUtc(data.date, data.start_time!);

  const ends_at =
    !data.all_day && data.end_time
      ? dateTimeToFamilyUtc(data.date, data.end_time)
      : null;

  const recurrence = data.recurrence === "none" ? null : data.recurrence;
  const recurrence_until =
    recurrence && data.recurrence_until ? data.recurrence_until : null;

  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("events")
    .update({
      title: data.title,
      description: data.description || null,
      category: data.category,
      starts_at: starts_at.toISOString(),
      ends_at: ends_at ? ends_at.toISOString() : null,
      all_day: data.all_day,
      location: data.location || null,
      recurrence,
      recurrence_until,
    })
    .eq("id", id)
    .select("id, family_id")
    .single();

  if (error || !event) return { error: "No se pudo actualizar el evento." };

  await saveParticipantsAndReminders(
    event.id,
    event.family_id,
    participant_ids,
    reminderMinutes,
    data.telegram,
  );

  revalidatePath("/eventos");
  revalidatePath("/");
  return { success: true, id: event.id };
}

async function saveParticipantsAndReminders(
  eventId: string,
  familyId: string,
  participantIds: string[],
  reminderMinutes: number[],
  telegram: boolean,
) {
  const supabase = await createClient();

  // Participantes: simple de diffear, borrar y recrear — no hay ninguna
  // otra tabla que referencie event_participants, así que no hay efecto
  // colateral en volver a insertarlos con id nuevo.
  await supabase.from("event_participants").delete().eq("event_id", eventId);
  if (participantIds.length > 0) {
    await supabase.from("event_participants").insert(
      participantIds.map((member_id) => ({
        event_id: eventId,
        member_id,
        family_id: familyId,
      })),
    );
  }

  // Recordatorios: acá SÍ hace falta diffear en vez de borrar y recrear.
  // reminder_deliveries referencia event_reminders.id con on delete
  // cascade — si se recrean todos los recordatorios en cada edición
  // (incluso al cambiar solo el lugar o la descripción), se pierde el
  // historial de qué ya se avisó y un recordatorio de un evento
  // recurrente que ya se mandó para la próxima ocurrencia se volvería a
  // mandar. Por eso solo se borran los recordatorios que el usuario
  // sacó y solo se insertan los que agregó.
  const desiredReminders: { offset_minutes: number; channel: "calendar" | "telegram" }[] = [];
  for (const offset_minutes of reminderMinutes) {
    desiredReminders.push({ offset_minutes, channel: "calendar" });
    if (telegram) desiredReminders.push({ offset_minutes, channel: "telegram" });
  }

  const { data: existingReminders } = await supabase
    .from("event_reminders")
    .select("id, offset_minutes, channel")
    .eq("event_id", eventId);

  const existing = existingReminders ?? [];

  const toDelete = existing.filter(
    (e) =>
      !desiredReminders.some((d) => d.offset_minutes === e.offset_minutes && d.channel === e.channel),
  );
  const toInsert = desiredReminders.filter(
    (d) =>
      !existing.some((e) => e.offset_minutes === d.offset_minutes && e.channel === d.channel),
  );

  if (toDelete.length > 0) {
    await supabase
      .from("event_reminders")
      .delete()
      .in("id", toDelete.map((e) => e.id));
  }

  if (toInsert.length > 0) {
    await supabase.from("event_reminders").insert(
      toInsert.map((d) => ({
        event_id: eventId,
        family_id: familyId,
        offset_minutes: d.offset_minutes,
        channel: d.channel,
      })),
    );
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) return { error: "No se pudo eliminar el evento." };

  revalidatePath("/eventos");
  revalidatePath("/");
  return { success: true };
}
