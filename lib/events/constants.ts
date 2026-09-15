import type { EventCategory, RecurrenceRule } from "@/lib/supabase/types";

export const EVENT_CATEGORIES: Record<EventCategory, { label: string }> = {
  escolar: { label: "Escolar" },
  medico: { label: "Médico" },
  familiar: { label: "Familiar" },
  cumpleanos: { label: "Cumpleaños" },
  otro: { label: "Otro" },
};

// Categorías que se pueden elegir al crear/editar un evento — cumpleaños
// es de solo lectura, se deriva de family_members.birth_date.
export const EDITABLE_EVENT_CATEGORIES = (
  Object.keys(EVENT_CATEGORIES) as EventCategory[]
).filter((c) => c !== "cumpleanos");

export const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  weekly: "Cada semana",
  monthly: "Cada mes",
  yearly: "Cada año",
};

export const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: "Al momento", minutes: 0 },
  { label: "30 min antes", minutes: 30 },
  { label: "1 hora antes", minutes: 60 },
  { label: "1 día antes", minutes: 1440 },
  { label: "2 días antes", minutes: 2880 },
];
