import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { listEventsWithDetails as listEventsWithDetailsService } from "@/lib/services/eventos";
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
  const context = await getCurrentFamilyContext();
  if (!context) return [];
  const supabase = await createClient();
  return listEventsWithDetailsService(supabase, context.family.id);
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
