import type { AssetType, TaskRecurrenceAnchor, TaskRecurrenceUnit } from "@/lib/supabase/types";

export const ASSET_TYPES: Record<AssetType, { label: string }> = {
  electrodomestico: { label: "Electrodoméstico" },
  instalacion: { label: "Instalación" },
  vehiculo: { label: "Vehículo" },
  otro: { label: "Otro" },
};

export const RECURRENCE_UNIT_LABELS: Record<TaskRecurrenceUnit, string> = {
  days: "días",
  weeks: "semanas",
  months: "meses",
  years: "años",
};

export const RECURRENCE_ANCHOR_LABELS: Record<TaskRecurrenceAnchor, { label: string; hint: string }> = {
  completion: {
    label: "Desde que se hace",
    hint: "El próximo vencimiento se cuenta desde la fecha real en que se completa. Usalo para limpieza y mantenimiento (filtros, aceite, service).",
  },
  schedule: {
    label: "Fecha fija",
    hint: "El próximo vencimiento se cuenta desde el vencimiento teórico anterior, aunque se haga tarde. Usalo para impuestos, seguros y renovaciones.",
  },
};

export const RECURRENCE_PRESETS: {
  label: string;
  every: number;
  unit: TaskRecurrenceUnit;
}[] = [
  { label: "Mensual", every: 1, unit: "months" },
  { label: "Trimestral", every: 3, unit: "months" },
  { label: "Semestral", every: 6, unit: "months" },
  { label: "Anual", every: 1, unit: "years" },
];
