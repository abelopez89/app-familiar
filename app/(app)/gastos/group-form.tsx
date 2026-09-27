"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, X } from "lucide-react";
import { createExpenseGroup } from "./actions";
import { CURRENCIES, GROUP_KINDS } from "@/lib/expenses/constants";
import type { ExpenseGroup, ExpenseGroupKind, FamilyMember } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Datos del grupo (nombre, tipo, fechas, cotizaciones por defecto). Lo
 * usan el alta completa y el diálogo de ajustes del grupo.
 */
export function GroupDetailsFields({ group }: { group?: ExpenseGroup }) {
  const [kind, setKind] = useState<ExpenseGroupKind>(group?.kind ?? "viaje");

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={group?.name} placeholder="Viaje a Brasil 2027" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Tipo</Label>
        <input type="hidden" name="kind" value={kind} />
        <div className="flex gap-2">
          {(Object.keys(GROUP_KINDS) as ExpenseGroupKind[]).map((k) => (
            <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
              {GROUP_KINDS[k].label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="starts_on">Desde</Label>
        <Input id="starts_on" name="starts_on" type="date" defaultValue={group?.starts_on ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ends_on">Hasta</Label>
        <Input id="ends_on" name="ends_on" type="date" defaultValue={group?.ends_on ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Cotizaciones por defecto (Gs por unidad)</Label>
        <p className="text-xs text-muted-foreground">
          Se precargan en cada gasto en esa moneda y se pueden cambiar gasto por gasto — por ejemplo, cuando llega el
          resumen de la tarjeta.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.filter((c) => c.code !== "PYG").map((c) => (
            <div key={c.code} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-sm font-medium text-muted-foreground">{c.code}</span>
              <DecimalInput
                name={`rate_${c.code}`}
                defaultValue={group?.default_rates?.[c.code]?.toString() ?? ""}
                placeholder="—"
                aria-label={`Cotización de ${c.label}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" defaultValue={group?.description ?? ""} />
      </div>
    </>
  );
}

/** Botón-chip seleccionable, el mismo en todos los formularios del módulo. */
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "tap-target flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        selected ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Alta de grupo. Con `quick` es el "grupo rápido": solo nombre y
 * participantes (los miembros de la familia preseleccionados), y al
 * guardar lleva directo a cargar el primer gasto — una cena suelta no
 * debería costar más que el gasto en sí.
 */
export function GroupForm({ members, quick }: { members: FamilyMember[]; quick: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const [guests, setGuests] = useState<string[]>([]);
  const [guestDraft, setGuestDraft] = useState("");

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addGuest() {
    const name = guestDraft.trim();
    if (!name) return;
    setGuests((prev) => [...prev, name]);
    setGuestDraft("");
  }

  function handleSubmit(formData: FormData) {
    for (const id of selectedMembers) formData.append("member_ids", id);
    const pendingGuest = guestDraft.trim();
    for (const g of pendingGuest ? [...guests, pendingGuest] : guests) formData.append("guests", g);
    if (quick) formData.set("kind", "evento");

    startTransition(async () => {
      const result = await createExpenseGroup(formData);
      if (result.error || !result.id) {
        toast.error(result.error ?? "No se pudo crear el grupo.");
        return;
      }
      router.push(quick ? `/gastos/${result.id}/nuevo` : `/gastos/${result.id}`);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      {quick ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" placeholder="Cena del sábado" required autoFocus />
        </div>
      ) : (
        <GroupDetailsFields />
      )}

      <div className="flex flex-col gap-2">
        <Label>Participantes</Label>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <Chip key={m.id} selected={selectedMembers.has(m.id)} onClick={() => toggleMember(m.id)}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: m.color }} />
              {m.display_name}
              {selectedMembers.has(m.id) && <Check className="size-3.5" />}
            </Chip>
          ))}
          {guests.map((g, i) => (
            <Chip key={`${g}-${i}`} selected onClick={() => setGuests((prev) => prev.filter((_, j) => j !== i))}>
              {g}
              <X className="size-3.5" />
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={guestDraft}
            onChange={(e) => setGuestDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGuest();
              }
            }}
            placeholder="Invitado (nick)"
            aria-label="Nombre del invitado"
          />
          <Button type="button" variant="outline" size="icon" onClick={addGuest} aria-label="Agregar invitado">
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Los invitados son solo de este grupo: el amigo que viene al viaje y no usa la app.
        </p>
      </div>

      <Button type="submit" disabled={isPending} className="h-12 text-base">
        {isPending ? "Creando…" : quick ? "Crear y cargar el primer gasto" : "Crear grupo"}
      </Button>
    </form>
  );
}
