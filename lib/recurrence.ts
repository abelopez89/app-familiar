import { addDays, addMonths, addYears } from "date-fns";
import { dateOnlyInFamilyTimezone } from "./dates";

export type RecurrenceRule = "weekly" | "monthly" | "yearly";

/**
 * Forma mínima que necesita la expansión — cualquier fila de `events`
 * (o un objeto armado a mano, como los cumpleaños virtuales) cumple esto.
 */
export type RecurringEvent = {
  starts_at: string;
  ends_at: string | null;
  recurrence: RecurrenceRule | null;
  recurrence_until: string | null;
};

export type Occurrence<T extends RecurringEvent> = {
  event: T;
  starts_at: Date;
  ends_at: Date | null;
};

const MAX_OCCURRENCES = 500;

function step(date: Date, rule: RecurrenceRule): Date {
  switch (rule) {
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addYears(date, 1);
  }
}

/**
 * Expande la definición de recurrencia de un evento en instancias
 * concretas dentro de la ventana [from, to] (ambos inclusive). No
 * implementa excepciones a series ni RRULE completo — solo el paso fijo
 * semanal/mensual/anual con límite opcional `recurrence_until`.
 *
 * Se guarda la definición, no las instancias: esta función es la única
 * fuente de expansión — la usan la vista de calendario, el dashboard y
 * el cron de recordatorios, para no tener tres implementaciones
 * distintas que puedan desincronizarse.
 */
export function expandOccurrences<T extends RecurringEvent>(
  event: T,
  from: Date,
  to: Date,
): Occurrence<T>[] {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const durationMs = end ? end.getTime() - start.getTime() : null;

  const occurrences: Occurrence<T>[] = [];

  const overlapsWindow = (occStart: Date, occEnd: Date | null) => {
    const effectiveEnd = occEnd ?? occStart;
    return occStart.getTime() <= to.getTime() && effectiveEnd.getTime() >= from.getTime();
  };

  if (!event.recurrence) {
    if (overlapsWindow(start, end)) {
      occurrences.push({ event, starts_at: start, ends_at: end });
    }
    return occurrences;
  }

  const until = event.recurrence_until;
  let occStart = start;
  let count = 0;

  while (occStart.getTime() <= to.getTime() && count < MAX_OCCURRENCES) {
    count += 1;

    if (until && dateOnlyInFamilyTimezone(occStart) > until) {
      break;
    }

    const occEnd = durationMs !== null ? new Date(occStart.getTime() + durationMs) : null;

    if (overlapsWindow(occStart, occEnd)) {
      occurrences.push({ event, starts_at: occStart, ends_at: occEnd });
    }

    occStart = step(occStart, event.recurrence);
  }

  return occurrences;
}
