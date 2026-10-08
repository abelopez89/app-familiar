import "server-only";
import { fail, type Actor, type Db, type ServiceResult } from "@/lib/services/types";
import type { EventReminder, FamilyMember } from "@/lib/supabase/types";
import type { EventWithDetails } from "@/lib/events/queries";

// Lecturas de eventos y miembros compartidas entre la app y el bot
// (`/hoy`, "Ver agenda del día"). La expansión de recurrencia y los
// cumpleaños siguen en un solo lugar (`buildDisplayEvents`), esto solo
// trae los datos — filtrados por familia a mano (ver lib/services/types.ts).

/** Miembros activos de la familia, en orden de alta. */
export async function listActiveMembers(db: Db, familyId: string): Promise<FamilyMember[]> {
  const { data } = await db
    .from("family_members")
    .select("*")
    .eq("family_id", familyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * Todos los eventos de la familia con participantes y recordatorios. Sin
 * filtro de fechas: la recurrencia se expande en memoria sobre la
 * ventana que se quiera mostrar.
 */
export async function listEventsWithDetails(db: Db, familyId: string): Promise<EventWithDetails[]> {
  const [eventsRes, participantsRes, remindersRes] = await Promise.all([
    db.from("events").select("*").eq("family_id", familyId).order("starts_at", { ascending: true }),
    db.from("event_participants").select("*").eq("family_id", familyId),
    db.from("event_reminders").select("*").eq("family_id", familyId),
  ]);

  if (eventsRes.error) throw eventsRes.error;

  const participants = participantsRes.data ?? [];
  const reminders: EventReminder[] = remindersRes.data ?? [];

  return (eventsRes.data ?? []).map((event) => ({
    ...event,
    participant_ids: participants.filter((p) => p.event_id === event.id).map((p) => p.member_id),
    reminders: reminders.filter((r) => r.event_id === event.id),
  }));
}

// ============ Alta de eventos (compartida con el bot, `/evento`) ============

export type NewEventInput = {
  title: string;
  description: string | null;
  category: "escolar" | "medico" | "familiar" | "otro";
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  recurrence: "weekly" | "monthly" | "yearly" | null;
  recurrenceUntil: string | null;
  participantIds: string[];
  reminderMinutes: number[];
  telegram: boolean;
};

/**
 * Crea un evento con sus participantes y recordatorios. Las fechas llegan
 * ya resueltas en la zona de la familia (`dateOnlyToFamilyMidnightUtc` /
 * `dateTimeToFamilyUtc`): este servicio no interpreta texto ni zonas.
 */
export async function createEvent(
  db: Db,
  actor: Actor,
  input: NewEventInput,
): Promise<ServiceResult<{ id: string }>> {
  const { data: event, error } = await db
    .from("events")
    .insert({
      family_id: actor.familyId,
      title: input.title,
      description: input.description,
      category: input.category,
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt ? input.endsAt.toISOString() : null,
      all_day: input.allDay,
      location: input.location,
      recurrence: input.recurrence,
      recurrence_until: input.recurrence ? input.recurrenceUntil : null,
      created_by: actor.memberId,
    })
    .select("id")
    .single();

  if (error || !event) return fail("No se pudo crear el evento.");

  await saveParticipantsAndReminders(
    db,
    event.id,
    actor.familyId,
    input.participantIds,
    input.reminderMinutes,
    input.telegram,
  );

  return { ok: true, id: event.id };
}

export async function saveParticipantsAndReminders(
  db: Db,
  eventId: string,
  familyId: string,
  participantIds: string[],
  reminderMinutes: number[],
  telegram: boolean,
) {
  // Solo miembros de esta familia: con el admin client (bot) no hay RLS
  // que impida colgar de un evento a un miembro de otra familia.
  const members = participantIds.length > 0 ? await listActiveMembers(db, familyId) : [];
  const validIds = participantIds.filter((id) => members.some((m) => m.id === id));

  // Participantes: simple de diffear, borrar y recrear — no hay ninguna
  // otra tabla que referencie event_participants, así que no hay efecto
  // colateral en volver a insertarlos con id nuevo.
  await db.from("event_participants").delete().eq("family_id", familyId).eq("event_id", eventId);
  if (validIds.length > 0) {
    await db.from("event_participants").insert(
      validIds.map((member_id) => ({
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

  const { data: existingReminders } = await db
    .from("event_reminders")
    .select("id, offset_minutes, channel")
    .eq("family_id", familyId)
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
    await db
      .from("event_reminders")
      .delete()
      .eq("family_id", familyId)
      .in("id", toDelete.map((e) => e.id));
  }

  if (toInsert.length > 0) {
    await db.from("event_reminders").insert(
      toInsert.map((d) => ({
        event_id: eventId,
        family_id: familyId,
        offset_minutes: d.offset_minutes,
        channel: d.channel,
      })),
    );
  }
}
