"use client";

import { Cake, MapPin } from "lucide-react";
import type { DisplayEvent } from "@/lib/events/view-model";
import type { FamilyMember } from "@/lib/supabase/types";
import { EVENT_CATEGORIES } from "@/lib/events/constants";
import { formatTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { EventFormDialog } from "./event-form-dialog";

export function EventRow({
  display,
  members,
}: {
  display: DisplayEvent;
  members: FamilyMember[];
}) {
  const participants = members.filter((m) => display.participant_ids.includes(m.id));

  const content = (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-14 shrink-0 text-xs text-muted-foreground">
        {display.all_day ? "Todo el día" : formatTime(display.starts_at)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 truncate font-medium">
          {display.isBirthday && <Cake className="size-3.5 shrink-0 text-muted-foreground" />}
          {display.title}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {EVENT_CATEGORIES[display.category].label}
          </Badge>
          {display.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {display.location}
            </span>
          )}
        </div>
      </div>
      {participants.length > 0 && (
        <div className="flex -space-x-1.5">
          {participants.slice(0, 3).map((m) => (
            <span
              key={m.id}
              className="size-5 rounded-full ring-2 ring-background"
              style={{ backgroundColor: m.color }}
              title={m.display_name}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (display.isBirthday || !display.sourceEvent) {
    return <div className="min-h-14">{content}</div>;
  }

  return (
    <EventFormDialog
      members={members}
      event={display.sourceEvent}
      trigger={
        <button type="button" className="block w-full min-h-14 text-left">
          {content}
        </button>
      }
    />
  );
}
