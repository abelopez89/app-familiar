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
    <div className="flex flex-wrap gap-2">
      {members.map((member) => {
        const active = selected.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => toggle(member.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              active ? "border-primary bg-primary/10" : "border-input",
            )}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: member.color }}
            />
            {member.display_name}
          </button>
        );
      })}
    </div>
  );
}
