"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createEvent, updateEvent, type ActionResult } from "./actions";
import { DeleteEventButton } from "./delete-event-button";
import type { EventWithDetails } from "@/lib/events/queries";
import type { EventCategory, FamilyMember, RecurrenceRule } from "@/lib/supabase/types";
import { EDITABLE_EVENT_CATEGORIES, EVENT_CATEGORIES, REMINDER_PRESETS } from "@/lib/events/constants";
import { dateOnlyInFamilyTimezone, formatTime, todayInFamilyTimezone } from "@/lib/dates";
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
  members: FamilyMember[];
  event?: EventWithDetails;
  defaultDate?: string;
  trigger?: React.ReactNode;
  /** Abre el diálogo ya montado — lo usa el acceso rápido del inicio
   *  (`/eventos?nuevo=1`), para que crear un evento sea un solo toque
   *  desde la pantalla principal. */
  defaultOpen?: boolean;
};

export function EventFormDialog({ members, event, defaultDate, trigger, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [recurrence, setRecurrence] = useState<RecurrenceRule | "none">(
    event?.recurrence ?? "none",
  );
  const [telegram, setTelegram] = useState(
    event?.reminders.some((r) => r.channel === "telegram") ?? false,
  );

  const action = event ? updateEvent : createEvent;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      toast.success(event ? "Evento actualizado." : "Evento creado.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, event]);

  const initialDate = event
    ? dateOnlyInFamilyTimezone(event.starts_at)
    : (defaultDate ?? todayInFamilyTimezone());

  const calendarReminderMinutes = new Set(
    (event?.reminders ?? []).filter((r) => r.channel === "calendar").map((r) => r.offset_minutes),
  );

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
          <DialogTitle>{event ? "Editar evento" : "Nuevo evento"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {event && <input type="hidden" name="id" value={event.id} />}
          <input type="hidden" name="all_day" value={allDay ? "on" : ""} />
          <input type="hidden" name="recurrence" value={recurrence} />
          <input type="hidden" name="telegram" value={telegram ? "on" : ""} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" defaultValue={event?.title} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" name="date" type="date" defaultValue={initialDate} required />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="all_day_toggle">Todo el día</Label>
            <Switch id="all_day_toggle" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          {!allDay && (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="start_time">Hora</Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={event && !event.all_day ? formatTime(event.starts_at) : ""}
                  required={!allDay}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="end_time">Hora de fin (opcional)</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={
                    event && !event.all_day && event.ends_at ? formatTime(event.ends_at) : ""
                  }
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Categoría</Label>
            <Select
              name="category"
              defaultValue={
                event && event.category !== "cumpleanos" ? event.category : "familiar"
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_EVENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {EVENT_CATEGORIES[c as EventCategory].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Participantes (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <label key={member.id} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="participant_ids"
                    value={member.id}
                    defaultChecked={event?.participant_ids.includes(member.id)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary/10">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: member.color }}
                    />
                    {member.display_name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Lugar (opcional)</Label>
            <Input id="location" name="location" defaultValue={event?.location ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Notas (opcional)</Label>
            <Textarea id="description" name="description" defaultValue={event?.description ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Repetición</Label>
            <Select
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as RecurrenceRule | "none")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No se repite</SelectItem>
                <SelectItem value="weekly">Cada semana</SelectItem>
                <SelectItem value="monthly">Cada mes</SelectItem>
                <SelectItem value="yearly">Cada año</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recurrence !== "none" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurrence_until">Repetir hasta (opcional)</Label>
              <Input
                id="recurrence_until"
                name="recurrence_until"
                type="date"
                defaultValue={event?.recurrence_until ?? ""}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Recordatorios (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              {REMINDER_PRESETS.map((preset) => (
                <label key={preset.minutes} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="reminder_minutes"
                    value={preset.minutes}
                    defaultChecked={calendarReminderMinutes.has(preset.minutes)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary/10">
                    {preset.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="telegram_toggle">Avisar también por Telegram</Label>
            <Switch id="telegram_toggle" checked={telegram} onCheckedChange={setTelegram} />
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            {event ? (
              <DeleteEventButton eventId={event.id} onDeleted={() => setOpen(false)} />
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
