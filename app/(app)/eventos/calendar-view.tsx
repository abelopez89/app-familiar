"use client";

import { useEffect, useMemo, useState } from "react";
import { List, LayoutGrid } from "lucide-react";
import {
  addDaysToDateOnly,
  addMonthsToDateOnly,
  dateOnlyInFamilyTimezone,
  dateOnlyToFamilyMidnightUtc,
  todayInFamilyTimezone,
} from "@/lib/dates";
import type { EventWithDetails } from "@/lib/events/queries";
import type { FamilyMember } from "@/lib/supabase/types";
import { buildDisplayEvents, eventMatchesMemberFilter } from "@/lib/events/view-model";
import { cn } from "@/lib/utils";
import { MonthGrid } from "./month-grid";
import { AgendaList } from "./agenda-list";
import { MemberFilterChips } from "./member-filter-chips";
import { EventFormDialog } from "./event-form-dialog";
import { EventRow } from "./event-row";

type View = "grilla" | "agenda";
const STORAGE_KEY = "eventos-vista";

export function CalendarView({
  events,
  members,
}: {
  events: EventWithDetails[];
  members: FamilyMember[];
}) {
  const today = todayInFamilyTimezone();
  const [view, setView] = useState<View>("agenda");
  const [monthStart, setMonthStart] = useState(today.slice(0, 7) + "-01");
  const [selectedDate, setSelectedDate] = useState(today);
  const [memberFilter, setMemberFilter] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "grilla" || stored === "agenda") setView(stored);
    } catch {
      // localStorage puede fallar en modo privado — no pasa nada, se
      // queda con la vista por defecto.
    }
  }, []);

  function changeView(next: View) {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ver comentario arriba
    }
  }

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const gridDisplayEvents = useMemo(() => {
    const from = dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(monthStart, -7));
    const to = dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(addMonthsToDateOnly(monthStart, 1), 7));
    return buildDisplayEvents(events, members, from, to).filter((e) =>
      eventMatchesMemberFilter(e, memberFilter),
    );
  }, [events, members, monthStart, memberFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof gridDisplayEvents>();
    for (const event of gridDisplayEvents) {
      const day = dateOnlyInFamilyTimezone(event.starts_at);
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
    return map;
  }, [gridDisplayEvents]);

  const selectedDayEvents = eventsByDay.get(selectedDate) ?? [];

  const agendaDisplayEvents = useMemo(() => {
    const from = dateOnlyToFamilyMidnightUtc(today);
    const to = dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, 31));
    return buildDisplayEvents(events, members, from, to).filter((e) =>
      eventMatchesMemberFilter(e, memberFilter),
    );
  }, [events, members, today, memberFilter]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Eventos</h1>
        <div className="flex rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => changeView("grilla")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
              view === "grilla" && "bg-muted",
            )}
          >
            <LayoutGrid className="size-3.5" />
            Grilla
          </button>
          <button
            type="button"
            onClick={() => changeView("agenda")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
              view === "agenda" && "bg-muted",
            )}
          >
            <List className="size-3.5" />
            Agenda
          </button>
        </div>
      </div>

      <MemberFilterChips members={members} selected={memberFilter} onChange={setMemberFilter} />

      {view === "grilla" ? (
        <div className="flex flex-col gap-4">
          <div
            tabIndex={0}
            className="outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setMonthStart((m) => addMonthsToDateOnly(m, -1));
              if (e.key === "ArrowRight") setMonthStart((m) => addMonthsToDateOnly(m, 1));
            }}
          >
            <MonthGrid
              monthStart={monthStart}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onNavigateMonth={(delta) => setMonthStart((m) => addMonthsToDateOnly(m, delta))}
              eventsByDay={eventsByDay}
              membersById={membersById}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-semibold text-muted-foreground">
              {selectedDayEvents.length === 0 ? "Sin eventos este día" : "Eventos del día"}
            </h2>
            {selectedDayEvents.length > 0 && (
              <div className="flex flex-col divide-y rounded-lg border">
                {selectedDayEvents.map((event) => (
                  <EventRow key={event.id} display={event} members={members} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <AgendaList events={agendaDisplayEvents} members={members} />
      )}

      <div className="fixed bottom-20 right-4 z-40">
        <EventFormDialog
          members={members}
          defaultDate={view === "grilla" ? selectedDate : today}
        />
      </div>
    </div>
  );
}
