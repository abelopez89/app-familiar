import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysToDateOnly, dateOnlyToFamilyMidnightUtc, todayInFamilyTimezone } from "@/lib/dates";
import type { EventWithDetails } from "@/lib/events/queries";
import type { FamilyMember } from "@/lib/supabase/types";

export type CalendarFeedData = {
  familyName: string;
  events: EventWithDetails[];
  members: FamilyMember[];
};

const MONTHS_BACK = 6;
const MONTHS_FORWARD = 24;

/**
 * Resuelve el feed ICS de una familia a partir de su calendar_token, sin
 * sesión — Apple y Google lo piden directo, sin cookies. Usa el admin
 * client (service role): hogar.current_family_id() depende de auth.uid(),
 * que acá es null, así que RLS no filtra nada. El filtrado por family_id
 * es responsabilidad explícita de esta función — es el único lugar del
 * proyecto donde una fuga de family_id significa que una familia ve los
 * eventos de otra. Revisar con cuidado cualquier cambio acá: TODAS las
 * consultas de abajo filtran por family_id a mano.
 */
export async function getCalendarFeedData(token: string): Promise<CalendarFeedData | null> {
  const supabase = createAdminClient();

  const { data: member } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("calendar_token", token)
    .maybeSingle();

  if (!member) return null;

  const familyId = member.family_id;

  const [familyRes, eventsRes, participantsRes, remindersRes, membersRes] = await Promise.all([
    supabase.from("families").select("name").eq("id", familyId).maybeSingle(),
    supabase
      .from("events")
      .select("*")
      .eq("family_id", familyId)
      .order("starts_at", { ascending: true }),
    supabase.from("event_participants").select("*").eq("family_id", familyId),
    supabase.from("event_reminders").select("*").eq("family_id", familyId),
    supabase.from("family_members").select("*").eq("family_id", familyId).eq("is_active", true),
  ]);

  if (!familyRes.data) return null;

  const participants = participantsRes.data ?? [];
  const reminders = remindersRes.data ?? [];

  const today = todayInFamilyTimezone();
  const windowFrom = dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, -30 * MONTHS_BACK));
  const windowTo = dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, 30 * MONTHS_FORWARD));

  const eventsInWindow = (eventsRes.data ?? []).filter((event) => {
    // Un evento recurrente sigue vigente mientras su serie no haya
    // terminado antes de la ventana, sin importar cuándo empezó
    // originalmente — el cliente de calendario expande el RRULE.
    if (event.recurrence) {
      if (!event.recurrence_until) return true;
      return dateOnlyToFamilyMidnightUtc(event.recurrence_until) >= windowFrom;
    }
    const startsAt = new Date(event.starts_at);
    return startsAt >= windowFrom && startsAt <= windowTo;
  });

  const eventsWithDetails: EventWithDetails[] = eventsInWindow.map((event) => ({
    ...event,
    participant_ids: participants
      .filter((p) => p.event_id === event.id)
      .map((p) => p.member_id),
    reminders: reminders.filter((r) => r.event_id === event.id),
  }));

  return {
    familyName: familyRes.data.name,
    events: eventsWithDetails,
    members: membersRes.data ?? [],
  };
}
