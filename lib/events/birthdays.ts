import { dateOnlyInFamilyTimezone, dateOnlyToFamilyMidnightUtc } from "@/lib/dates";
import { expandOccurrences, type RecurringEvent } from "@/lib/recurrence";
import type { FamilyMember } from "@/lib/supabase/types";

/**
 * Cumpleaños derivados de family_members.birth_date. No se guardan como
 * eventos — son eventos virtuales, de solo lectura, generados en memoria.
 */
export type BirthdayOccurrence = {
  id: string;
  member_id: string;
  member_name: string;
  member_color: string;
  title: string;
  age: number;
  starts_at: Date;
};

export function expandBirthdays(
  members: FamilyMember[],
  from: Date,
  to: Date,
): BirthdayOccurrence[] {
  const result: BirthdayOccurrence[] = [];

  for (const member of members) {
    if (!member.birth_date) continue;

    const birthYear = Number(member.birth_date.slice(0, 4));
    const rule: RecurringEvent = {
      starts_at: dateOnlyToFamilyMidnightUtc(member.birth_date).toISOString(),
      ends_at: null,
      recurrence: "yearly",
      recurrence_until: null,
    };

    for (const occ of expandOccurrences(rule, from, to)) {
      const occYear = Number(dateOnlyInFamilyTimezone(occ.starts_at).slice(0, 4));
      const age = occYear - birthYear;
      if (age <= 0) continue;

      result.push({
        id: `cumpleanos:${member.id}:${occYear}`,
        member_id: member.id,
        member_name: member.display_name,
        member_color: member.color,
        title: `${member.display_name} cumple ${age}`,
        age,
        starts_at: occ.starts_at,
      });
    }
  }

  return result.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
}
