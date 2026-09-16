"use client";

import type { FamilyMember } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export function MemberFilterChips({
  members,
  selected,
  onChange,
}: {
  members: FamilyMember[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);
  }

  if (members.length === 0) return null;

  return (
    // Scroll horizontal en vez de envolverse: con cuatro o cinco miembros
    // dos renglones de chips empujaban el calendario fuera de la pantalla
    // del celular antes de ver el primer evento.
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {members.map((member) => {
        const active = selected.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => toggle(member.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card active:bg-muted",
            )}
          >
            <span
              className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: member.color }}
            />
            {member.display_name}
          </button>
        );
      })}
    </div>
  );
}
