import "server-only";
import type { Db } from "@/lib/services/types";
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
