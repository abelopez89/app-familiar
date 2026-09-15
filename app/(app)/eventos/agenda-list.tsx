"use client";

import {
  addDaysToDateOnly,
  dateOnlyInFamilyTimezone,
  dateOnlyToFamilyMidnightUtc,
  formatDate,
  todayInFamilyTimezone,
} from "@/lib/dates";
import type { DisplayEvent } from "@/lib/events/view-model";
import type { FamilyMember } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { EventRow } from "./event-row";

export function AgendaList({
  events,
  members,
}: {
  events: DisplayEvent[];
  members: FamilyMember[];
}) {
  const today = todayInFamilyTimezone();
  const tomorrow = addDaysToDateOnly(today, 1);

  const groups = new Map<string, DisplayEvent[]>();
  for (const event of events) {
    const day = dateOnlyInFamilyTimezone(event.starts_at);
    const list = groups.get(day) ?? [];
    list.push(event);
    groups.set(day, list);
  }

  const days = [...groups.keys()].sort();

  if (days.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay eventos en los próximos 30 días.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <div key={day} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">
            {day === today
              ? "Hoy"
              : day === tomorrow
                ? "Mañana"
                : formatDate(dateOnlyToFamilyMidnightUtc(day), "EEEE d 'de' MMMM")}
          </h2>
          <Card>
            <CardContent className="flex flex-col divide-y p-0">
              {(groups.get(day) ?? []).map((event) => (
                <EventRow key={event.id} display={event} members={members} />
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
