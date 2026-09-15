"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDaysToDateOnly,
  dateOnlyToFamilyMidnightUtc,
  dayOfWeekOfDateOnly,
  daysInMonthOfDateOnly,
  formatDate,
  todayInFamilyTimezone,
} from "@/lib/dates";
import type { DisplayEvent } from "@/lib/events/view-model";
import type { FamilyMember } from "@/lib/supabase/types";
import { dotColorFor } from "@/lib/events/view-model";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const SWIPE_THRESHOLD_PX = 50;

export function MonthGrid({
  monthStart,
  selectedDate,
  onSelectDate,
  onNavigateMonth,
  eventsByDay,
  membersById,
}: {
  monthStart: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onNavigateMonth: (delta: number) => void;
  eventsByDay: Map<string, DisplayEvent[]>;
  membersById: Map<string, FamilyMember>;
}) {
  const touchStartX = useRef<number | null>(null);
  const today = todayInFamilyTimezone();

  const firstWeekday = (dayOfWeekOfDateOnly(monthStart) + 6) % 7; // 0 = lunes
  const daysInMonth = daysInMonthOfDateOnly(monthStart);
  const [year, month] = monthStart.split("-");

  const cells: string[] = [];
  for (let i = firstWeekday; i > 0; i--) {
    cells.push(addDaysToDateOnly(monthStart, -i));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(addDaysToDateOnly(cells[cells.length - 1], 1));
  }

  return (
    <div
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (delta > SWIPE_THRESHOLD_PX) onNavigateMonth(-1);
        else if (delta < -SWIPE_THRESHOLD_PX) onNavigateMonth(1);
        touchStartX.current = null;
      }}
    >
      <div className="flex items-center justify-between pb-2">
        <Button variant="ghost" size="icon" onClick={() => onNavigateMonth(-1)} aria-label="Mes anterior">
          <ChevronLeft className="size-5" />
        </Button>
        <span className="text-sm font-medium capitalize">
          {formatDate(dateOnlyToFamilyMidnightUtc(monthStart), "MMMM yyyy")}
        </span>
        <Button variant="ghost" size="icon" onClick={() => onNavigateMonth(1)} aria-label="Mes siguiente">
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateOnly) => {
          const inMonth = dateOnly.startsWith(monthStart.slice(0, 7));
          const isToday = dateOnly === today;
          const isSelected = dateOnly === selectedDate;
          const dayEvents = eventsByDay.get(dateOnly) ?? [];
          const dots = dayEvents.slice(0, 3);
          const hasMore = dayEvents.length > 3;

          return (
            <button
              key={dateOnly}
              type="button"
              onClick={() => onSelectDate(dateOnly)}
              className={cn(
                "flex aspect-square flex-col items-center justify-start gap-1 rounded-lg pt-1.5 text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                isSelected && "bg-primary/10 ring-1 ring-primary",
                !isSelected && isToday && "bg-muted",
              )}
            >
              <span className={cn(isToday && "font-semibold text-primary")}>
                {Number(dateOnly.slice(8, 10))}
              </span>
              <span className="flex h-2 items-center gap-0.5">
                {dots.map((d, i) =>
                  hasMore && i === 2 ? (
                    <span key="more" className="text-[8px] leading-none text-muted-foreground">
                      +
                    </span>
                  ) : (
                    <span
                      key={d.id}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: dotColorFor(d, membersById) }}
                    />
                  ),
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
