"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createTaskDefinition, updateTaskDefinition, type ActionResult } from "./actions";
import {
  RECURRENCE_ANCHOR_LABELS,
  RECURRENCE_PRESETS,
  RECURRENCE_UNIT_LABELS,
} from "@/lib/tasks/constants";
import { todayInFamilyTimezone } from "@/lib/dates";
import type { Asset, FamilyMember, TaskDefinition, TaskRecurrenceAnchor, TaskRecurrenceUnit } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

type Props = {
  assets: Asset[];
  members: FamilyMember[];
  definition?: TaskDefinition;
  trigger?: React.ReactNode;
};

const CUSTOM_PRESET = "custom";
const NONE_PRESET = "none";

export function DefinitionFormDialog({ assets, members, definition, trigger }: Props) {
  const [open, setOpen] = useState(false);

  const [hasRecurrence, setHasRecurrence] = useState(definition ? definition.recurrence_every !== null : true);
  const [every, setEvery] = useState(definition?.recurrence_every ?? 3);
  const [unit, setUnit] = useState<TaskRecurrenceUnit>(definition?.recurrence_unit ?? "months");
  const [anchor, setAnchor] = useState<TaskRecurrenceAnchor>(definition?.recurrence_anchor ?? "completion");
  const [notifyTelegram, setNotifyTelegram] = useState(definition?.notify_telegram ?? true);

  const matchingPreset = RECURRENCE_PRESETS.find((p) => p.every === every && p.unit === unit);
  const [presetValue, setPresetValue] = useState<string>(matchingPreset ? `${every}-${unit}` : CUSTOM_PRESET);

  const action = definition ? updateTaskDefinition : createTaskDefinition;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      toast.success(definition ? "Tarea actualizada." : "Tarea creada.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, definition]);

  function handlePresetChange(value: string) {
    setPresetValue(value);
    if (value === CUSTOM_PRESET) return;
    const preset = RECURRENCE_PRESETS.find((p) => `${p.every}-${p.unit}` === value);
    if (preset) {
      setEvery(preset.every);
      setUnit(preset.unit);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" className="size-14 rounded-full shadow-lg">
            <Plus className="size-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{definition ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {definition && <input type="hidden" name="id" value={definition.id} />}
          <input type="hidden" name="has_recurrence" value={hasRecurrence ? "on" : ""} />
          <input type="hidden" name="recurrence_unit" value={unit} />
          <input type="hidden" name="recurrence_anchor" value={anchor} />
          <input type="hidden" name="notify_telegram" value={notifyTelegram ? "on" : ""} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" defaultValue={definition?.title} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea id="description" name="description" defaultValue={definition?.description ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Activo (opcional)</Label>
            <Select name="asset_id" defaultValue={definition?.asset_id ?? NONE_PRESET}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_PRESET}>Ninguno</SelectItem>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Responsable (opcional)</Label>
            <Select name="assigned_to" defaultValue={definition?.assigned_to ?? NONE_PRESET}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_PRESET}>Cualquiera de la familia</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="next_due_date">Próximo vencimiento</Label>
            <Input
              id="next_due_date"
              name="next_due_date"
              type="date"
              defaultValue={definition?.next_due_date ?? todayInFamilyTimezone()}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="has_recurrence_toggle">Se repite</Label>
            <Switch id="has_recurrence_toggle" checked={hasRecurrence} onCheckedChange={setHasRecurrence} />
          </div>

          {hasRecurrence && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Frecuencia</Label>
                <Select value={presetValue} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_PRESETS.map((preset) => (
                      <SelectItem key={`${preset.every}-${preset.unit}`} value={`${preset.every}-${preset.unit}`}>
                        {preset.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_PRESET}>Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {presetValue === CUSTOM_PRESET && (
                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="recurrence_every">Cada</Label>
                    <Input
                      id="recurrence_every"
                      name="recurrence_every"
                      type="number"
                      min="1"
                      value={every}
                      onChange={(e) => setEvery(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label>Unidad</Label>
                    <Select value={unit} onValueChange={(v) => setUnit(v as TaskRecurrenceUnit)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(RECURRENCE_UNIT_LABELS) as TaskRecurrenceUnit[]).map((u) => (
                          <SelectItem key={u} value={u}>
                            {RECURRENCE_UNIT_LABELS[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {presetValue !== CUSTOM_PRESET && (
                <input type="hidden" name="recurrence_every" value={every} />
              )}

              <div className="flex flex-col gap-2">
                <Label>Se recalcula</Label>
                <Select value={anchor} onValueChange={(v) => setAnchor(v as TaskRecurrenceAnchor)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRENCE_ANCHOR_LABELS) as TaskRecurrenceAnchor[]).map((a) => (
                      <SelectItem key={a} value={a}>
                        {RECURRENCE_ANCHOR_LABELS[a].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{RECURRENCE_ANCHOR_LABELS[anchor].hint}</p>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead_days">Avisar con cuántos días de anticipación</Label>
            <Input
              id="lead_days"
              name="lead_days"
              type="number"
              min="0"
              defaultValue={definition?.lead_days ?? 2}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notify_telegram_toggle">Avisar por Telegram</Label>
            <Switch
              id="notify_telegram_toggle"
              checked={notifyTelegram}
              onCheckedChange={setNotifyTelegram}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
