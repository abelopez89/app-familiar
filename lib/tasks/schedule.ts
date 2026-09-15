import { addDaysToDateOnly, addMonthsToDateOnly, dateOnlyInFamilyTimezone } from "@/lib/dates";
import type { TaskRecurrenceAnchor, TaskRecurrenceUnit } from "@/lib/supabase/types";

// ============ Por qué esto no es lib/recurrence.ts ============
// Un evento recurre contra el calendario: la clase de natación es todos
// los martes, se haya ido o no. Una tarea de mantenimiento recurre
// contra el último cumplimiento real: "limpiar el filtro cada 3 meses"
// significa 3 meses desde que se limpió de verdad, no desde la fecha
// teórica anterior — si no, el sistema acumula un desfasaje y termina
// mintiendo. Por eso este módulo es independiente y opera sobre fechas
// calendario ("yyyy-MM-dd"), nunca sobre Date del navegador.

export const WARRANTY_LEAD_DAYS = 30;
const RENOTIFY_AFTER_DAYS = 7;

export function addRecurrenceInterval(
  dateOnly: string,
  every: number,
  unit: TaskRecurrenceUnit,
): string {
  switch (unit) {
    case "days":
      return addDaysToDateOnly(dateOnly, every);
    case "weeks":
      return addDaysToDateOnly(dateOnly, every * 7);
    case "months":
      return addMonthsToDateOnly(dateOnly, every);
    case "years":
      return addMonthsToDateOnly(dateOnly, every * 12);
  }
}

/**
 * Avanza `fromDateOnly` de a un intervalo hasta superar `today`. Es el
 * caso borde del ancla `schedule`: si una tarea muy atrasada recalculara
 * una sola vez contra su vencimiento teórico, el próximo vencimiento
 * podría seguir en el pasado y generar instancias vencidas en cadena
 * para siempre.
 */
function advanceUntilFuture(
  fromDateOnly: string,
  every: number,
  unit: TaskRecurrenceUnit,
  today: string,
): string {
  let next = addRecurrenceInterval(fromDateOnly, every, unit);
  while (next <= today) {
    next = addRecurrenceInterval(next, every, unit);
  }
  return next;
}

type RecurrenceDefinition = {
  recurrence_every: number | null;
  recurrence_unit: TaskRecurrenceUnit | null;
  recurrence_anchor: TaskRecurrenceAnchor;
};

/**
 * Recalcula next_due_date al completar una tarea. Devuelve null si la
 * tarea no tiene recurrencia (era única) — en ese caso la definición se
 * desactiva, no se le asigna next_due_date.
 *
 * Ancla `completion`: desde la fecha real de completado.
 * Ancla `schedule`: desde el vencimiento teórico de esa instancia (con
 * el catch-up de advanceUntilFuture si igual queda en el pasado).
 */
export function computeNextDueDateOnComplete(
  definition: RecurrenceDefinition,
  completedAtDateOnly: string,
  instanceDueDateOnly: string,
  today: string,
): string | null {
  if (definition.recurrence_every == null || definition.recurrence_unit == null) return null;

  if (definition.recurrence_anchor === "completion") {
    return addRecurrenceInterval(completedAtDateOnly, definition.recurrence_every, definition.recurrence_unit);
  }

  return advanceUntilFuture(
    instanceDueDateOnly,
    definition.recurrence_every,
    definition.recurrence_unit,
    today,
  );
}

/**
 * Recalcula next_due_date al omitir una tarea. Siempre con ancla
 * `schedule`, sin importar el ancla de la definición: si te salteaste
 * la limpieza del filtro, el próximo vencimiento no debe correrse 3
 * meses a partir de hoy como si se hubiera hecho.
 */
export function computeNextDueDateOnSkip(
  definition: RecurrenceDefinition,
  instanceDueDateOnly: string,
  today: string,
): string | null {
  if (definition.recurrence_every == null || definition.recurrence_unit == null) return null;

  return advanceUntilFuture(
    instanceDueDateOnly,
    definition.recurrence_every,
    definition.recurrence_unit,
    today,
  );
}

/**
 * Una definición activa tiene como máximo una instancia pendiente a la
 * vez. Genera una instancia nueva solo si no hay ninguna pendiente y el
 * vencimiento cae dentro de los próximos lead_days días (o ya pasó).
 */
export function shouldGenerateInstance(
  definition: { next_due_date: string; lead_days: number },
  hasPendingInstance: boolean,
  today: string,
): boolean {
  if (hasPendingInstance) return false;
  const threshold = addDaysToDateOnly(today, definition.lead_days);
  return definition.next_due_date <= threshold;
}

export function daysOverdue(dueDateOnly: string, today: string): number {
  const dueMs = Date.parse(`${dueDateOnly}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  return Math.round((todayMs - dueMs) / 86_400_000);
}

/**
 * Ventana de aviso compartida por tareas y garantías: avisa cuando faltan
 * `leadDays` para `referenceDate`, y si ya se avisó, recién vuelve a
 * avisar `RENOTIFY_AFTER_DAYS` después del último aviso — no todos los
 * días.
 */
function isWithinNotifyWindow(
  referenceDate: string,
  leadDays: number,
  lastNotifiedAt: string | null,
  today: string,
): boolean {
  const notifyFrom = addDaysToDateOnly(referenceDate, -leadDays);
  if (today < notifyFrom) return false;
  if (!lastNotifiedAt) return true;
  const notifiedDateOnly = dateOnlyInFamilyTimezone(lastNotifiedAt);
  return today >= addDaysToDateOnly(notifiedDateOnly, RENOTIFY_AFTER_DAYS);
}

export function shouldNotifyTaskInstance(
  instance: { due_date: string; notified_at: string | null },
  leadDays: number,
  today: string,
): boolean {
  return isWithinNotifyWindow(instance.due_date, leadDays, instance.notified_at, today);
}

export function shouldNotifyWarranty(
  asset: { warranty_until: string | null; warranty_notified_at: string | null },
  today: string,
): boolean {
  if (!asset.warranty_until) return false;
  return isWithinNotifyWindow(asset.warranty_until, WARRANTY_LEAD_DAYS, asset.warranty_notified_at, today);
}
