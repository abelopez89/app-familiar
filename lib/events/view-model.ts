import { expandOccurrences } from "@/lib/recurrence";
import { expandBirthdays } from "@/lib/events/birthdays";
import type { EventWithDetails } from "@/lib/events/queries";
import type { EventCategory, FamilyMember } from "@/lib/supabase/types";

export type DisplayEvent = {
  id: string;
  title: string;
  category: EventCategory;
  all_day: boolean;
  starts_at: Date;
  ends_at: Date | null;
  location: string | null;
  participant_ids: string[];
  isBirthday: boolean;
  sourceEvent: EventWithDetails | null;
};

/**
 * Combina eventos reales (expandidos según su recurrencia) y cumpleaños
 * virtuales en una sola lista para mostrar, dentro de la ventana
 * [from, to]. Un solo punto de expansión — lo usan la grilla, la agenda
 * y el bloque del dashboard.
 */
export function buildDisplayEvents(
  events: EventWithDetails[],
  members: FamilyMember[],
  from: Date,
  to: Date,
): DisplayEvent[] {
  const fromEvents: DisplayEvent[] = events.flatMap((event) =>
    expandOccurrences(event, from, to).map((occ) => ({
      id: `${event.id}:${occ.starts_at.toISOString()}`,
      title: event.title,
      category: event.category,
      all_day: event.all_day,
      starts_at: occ.starts_at,
      ends_at: occ.ends_at,
      location: event.location,
      participant_ids: event.participant_ids,
      isBirthday: false,
      sourceEvent: event,
    })),
  );

  const birthdays: DisplayEvent[] = expandBirthdays(members, from, to).map((b) => ({
    id: b.id,
    title: b.title,
    category: "cumpleanos",
    all_day: true,
    starts_at: b.starts_at,
    ends_at: null,
    location: null,
    participant_ids: [b.member_id],
    isBirthday: true,
    sourceEvent: null,
  }));

  return [...fromEvents, ...birthdays].sort(
    (a, b) => a.starts_at.getTime() - b.starts_at.getTime(),
  );
}

const FAMILY_DOT_COLOR = "#9ca3af";

export function dotColorFor(
  display: DisplayEvent,
  membersById: Map<string, FamilyMember>,
): string {
  const firstParticipant = display.participant_ids[0];
  if (!firstParticipant) return FAMILY_DOT_COLOR;
  return membersById.get(firstParticipant)?.color ?? FAMILY_DOT_COLOR;
}

export function eventMatchesMemberFilter(display: DisplayEvent, filter: string[]): boolean {
  if (filter.length === 0) return true;
  if (display.participant_ids.length === 0) return true; // evento de toda la familia
  return display.participant_ids.some((id) => filter.includes(id));
}
