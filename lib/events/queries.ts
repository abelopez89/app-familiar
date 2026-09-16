import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
// Reexportada desde lib/members.ts para que haya una sola instancia
// memoizada por request (ver el comentario de ese archivo).
export { listActiveMembers } from "@/lib/members";
import type { Event, EventReminder } from "@/lib/supabase/types";

export type EventWithDetails = Event & {
  participant_ids: string[];
  reminders: EventReminder[];
};

/**
 * Trae todos los eventos de la familia (RLS filtra por family_id) junto
 * con sus participantes y recordatorios. Se trae todo, sin filtrar por
 * rango de fechas: la expansión de recurrencia sobre la ventana visible
 * pasa por lib/recurrence.ts en memoria, así que un evento recurrente
 * viejo igual puede tener ocurrencias futuras dentro del rango.
 * Volumen esperado (agenda familiar) es chico, así que esto no es un
 * problema de escala en este proyecto.
 */
export const listEventsWithDetails = cache(async function listEventsWithDetails(): Promise<EventWithDetails[]> {
  const supabase = await createClient();

  const [eventsRes, participantsRes, remindersRes] = await Promise.all([
    supabase.from("events").select("*").order("starts_at", { ascending: true }),
    supabase.from("event_participants").select("*"),
    supabase.from("event_reminders").select("*"),
  ]);

  if (eventsRes.error) throw eventsRes.error;

  const participants = participantsRes.data ?? [];
  const reminders = remindersRes.data ?? [];

  return (eventsRes.data ?? []).map((event) => ({
    ...event,
    participant_ids: participants
      .filter((p) => p.event_id === event.id)
      .map((p) => p.member_id),
    reminders: reminders.filter((r) => r.event_id === event.id),
  }));
});

export async function getEventWithDetails(id: string): Promise<EventWithDetails | null> {
  const supabase = await createClient();

  const [eventRes, participantsRes, remindersRes] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("event_participants").select("*").eq("event_id", id),
    supabase.from("event_reminders").select("*").eq("event_id", id),
  ]);

  if (eventRes.error) throw eventRes.error;
  if (!eventRes.data) return null;

  return {
    ...eventRes.data,
    participant_ids: (participantsRes.data ?? []).map((p) => p.member_id),
    reminders: remindersRes.data ?? [],
  };
}
