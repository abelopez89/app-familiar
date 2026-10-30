"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createCard, deleteCard, updateCard, type ActionResult } from "./actions";
import { BANCOS, MARCAS, NIVELES, TIPOS_TARJETA } from "@/lib/promos/constants";
import { capitalizarPalabras, etiquetaNivel } from "@/lib/promos/normalize";
import type { FamilyMember, TarjetaFamilia } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function toOptions(catalog: Record<string, { label: string }>) {
  return Object.entries(catalog).map(([value, { label }]) => ({ value, label }));
}

export function CardFormDialog({
  card,
  members,
  defaultMemberId,
  trigger,
}: {
  card?: TarjetaFamilia;
  members: FamilyMember[];
  defaultMemberId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState(card?.member_id ?? defaultMemberId);
  const [banco, setBanco] = useState<string>(card?.banco ?? "");
  const [marca, setMarca] = useState<string>(card?.marca ?? "");
  const [nivel, setNivel] = useState<string>(card?.nivel ?? "");
  const [tipo, setTipo] = useState<string>(card?.tipo ?? "credito");
  const [activa, setActiva] = useState(card?.activa ?? true);
  const [deleting, startDelete] = useTransition();

  const action = card ? updateCard : createCard;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      toast.success(card ? "Tarjeta actualizada." : "Tarjeta agregada.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, card]);

  // Un nivel que no está en el catálogo (lo escribió un banco, no el
  // formulario) se sigue ofreciendo para no perderlo al editar.
  const nivelOptions = toOptions(NIVELES);
  if (card && !(card.nivel in NIVELES)) {
    nivelOptions.push({ value: card.nivel, label: etiquetaNivel(card.nivel) });
  }

  function handleDelete() {
    if (!card) return;
    if (!window.confirm(`¿Eliminar la tarjeta "${card.alias}"? Dejás de ver las promos que solo aplican a ella.`)) {
      return;
    }
    startDelete(async () => {
      const result = await deleteCard(card.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarjeta eliminada.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" className="size-14 rounded-full shadow-lg" aria-label="Agregar tarjeta">
            <Plus className="size-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? "Editar tarjeta" : "Nueva tarjeta"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {card && <input type="hidden" name="id" value={card.id} />}
          <input type="hidden" name="activa" value={String(activa)} />

          <SelectField
            label="De quién es"
            name="member_id"
            value={memberId}
            onChange={setMemberId}
            options={members.map((m) => ({ value: m.id, label: m.display_name }))}
          />

          <div className="flex gap-3">
            <SelectField
              label="Banco"
              name="banco"
              value={banco}
              onChange={setBanco}
              options={toOptions(BANCOS)}
              placeholder="Elegí"
            />
            <SelectField
              label="Marca"
              name="marca"
              value={marca}
              onChange={setMarca}
              options={toOptions(MARCAS)}
              placeholder="Elegí"
            />
          </div>

          <div className="flex gap-3">
            <SelectField
              label="Nivel"
              name="nivel"
              value={nivel}
              onChange={setNivel}
              options={nivelOptions}
              placeholder="Elegí"
            />
            <SelectField label="Tipo" name="tipo" value={tipo} onChange={setTipo} options={toOptions(TIPOS_TARJETA)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="afinidad">Afinidad (opcional)</Label>
            <Input
              id="afinidad"
              name="afinidad"
              placeholder="Ej: Farmacenter, Tarjeta B"
              defaultValue={card?.afinidad ? capitalizarPalabras(card.afinidad) : ""}
            />
            <p className="text-xs text-muted-foreground">
              El nombre que aparece en la tarjeta además del banco, si tiene uno.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="alias">Alias</Label>
            <Input id="alias" name="alias" placeholder="Ej: La Farmacenter de mamá" defaultValue={card?.alias} required />
            <p className="text-xs text-muted-foreground">No hace falta el número de la tarjeta.</p>
          </div>

          {card && (
            <label className="tap-target flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Activa</span>
                <span className="text-xs text-muted-foreground">Apagada, no se usa para las promos.</span>
              </span>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </label>
          )}

          <DialogFooter className="gap-2">
            {card && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={pending || deleting}
                onClick={handleDelete}
              >
                Eliminar
              </Button>
            )}
            <Button type="submit" disabled={pending || deleting}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
