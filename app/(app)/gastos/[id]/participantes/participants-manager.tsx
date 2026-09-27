"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, UserPlus } from "lucide-react";
import { addGroupParticipants, reactivateGroupParticipant, removeGroupParticipant } from "../../actions";
import type { FamilyMember, GroupParticipant } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/app-shell/page-header";

/**
 * Agregar miembros o invitados, y quitar. Agregar a alguien no cambia los
 * gastos ya cargados (sus partes están guardadas). Quitar borra solo si
 * la persona no tiene movimientos; si los tiene, la desactiva: deja de
 * aparecer para gastos nuevos pero sigue contando en los balances.
 */
export function ParticipantsManager({
  groupId,
  participants,
  availableMembers,
}: {
  groupId: string;
  participants: GroupParticipant[];
  availableMembers: FamilyMember[];
}) {
  const [isPending, startTransition] = useTransition();
  const [guest, setGuest] = useState("");

  function run(action: () => Promise<{ error?: string; deactivated?: boolean }>, success: (r: { deactivated?: boolean }) => string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(success(result));
    });
  }

  function addGuest() {
    const name = guest.trim();
    if (!name) return;
    run(
      () => addGroupParticipants(groupId, [], [name]),
      () => `${name} se sumó al grupo.`,
    );
    setGuest("");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionTitle>En el grupo</SectionTitle>
        <div className="flex flex-col divide-y rounded-xl border bg-card shadow-sm">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? undefined }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.display_name}</span>
                <span className="block text-xs text-muted-foreground">{p.member_id ? "Familia" : "Invitado"}</span>
              </span>
              {p.is_active ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      () => removeGroupParticipant(p.id),
                      (r) =>
                        r.deactivated
                          ? `${p.display_name} tiene movimientos: se desactivó y sigue contando en los balances.`
                          : `${p.display_name} salió del grupo.`,
                    )
                  }
                >
                  Quitar
                </Button>
              ) : (
                <>
                  <Badge variant="outline">Inactivo</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => run(() => reactivateGroupParticipant(p.id), () => `${p.display_name} volvió al grupo.`)}
                  >
                    Reactivar
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {availableMembers.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Sumar de la familia</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {availableMembers.map((m) => (
              <Button
                key={m.id}
                variant="outline"
                className="gap-2 rounded-full"
                disabled={isPending}
                onClick={() => run(() => addGroupParticipants(groupId, [m.id], []), () => `${m.display_name} se sumó al grupo.`)}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                {m.display_name}
                <Plus className="size-3.5" />
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>Sumar un invitado</SectionTitle>
        <div className="flex gap-2">
          <Input
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGuest();
              }
            }}
            placeholder="Nick"
            aria-label="Nombre del invitado"
          />
          <Button variant="outline" className="gap-2" disabled={isPending || !guest.trim()} onClick={addGuest}>
            <UserPlus className="size-4" />
            Sumar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Solo para este grupo. Los gastos ya cargados no cambian.</p>
      </section>
    </div>
  );
}
