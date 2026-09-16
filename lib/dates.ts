import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

export const FAMILY_TIMEZONE = "America/Asuncion";

export function formatDate(date: string | Date, pattern = "d 'de' MMMM"): string {
  return formatInTimeZone(date, FAMILY_TIMEZONE, pattern, { locale: es });
}

export function formatDateTime(date: string | Date): string {
  return formatInTimeZone(date, FAMILY_TIMEZONE, "d 'de' MMMM, HH:mm", { locale: es });
}

export function formatTime(date: string | Date): string {
  return formatInTimeZone(date, FAMILY_TIMEZONE, "HH:mm", { locale: es });
}

/**
 * Hora del día (0-23) en la zona de la familia. La usa el saludo del
 * inicio: `new Date().getHours()` del navegador daría la hora del
 * dispositivo, que en un celular en roaming no es la de Asunción.
 */
export function hourInFamilyTimezone(): number {
  return Number(formatInTimeZone(new Date(), FAMILY_TIMEZONE, "H"));
}

export function todayInFamilyTimezone(): string {
  return formatInTimeZone(new Date(), FAMILY_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Convierte una fecha calendario ("yyyy-MM-dd", tal como sale de un
 * <input type="date">) a la medianoche de ese día en America/Asuncion,
 * como Date en UTC. Es el único punto de entrada para eventos all_day:
 * nunca uses `new Date("yyyy-MM-dd")` para esto, porque toma la zona del
 * dispositivo del usuario, no la de la familia.
 */
export function dateOnlyToFamilyMidnightUtc(dateOnly: string): Date {
  return fromZonedTime(`${dateOnly}T00:00:00`, FAMILY_TIMEZONE);
}

/**
 * Combina una fecha calendario y una hora "HH:mm" (ambas tal como salen
 * de inputs nativos) interpretándolas en America/Asuncion, y devuelve el
 * instante UTC correspondiente. Mismo motivo que
 * dateOnlyToFamilyMidnightUtc: nunca construir esto con `new Date(...)`.
 */
export function dateTimeToFamilyUtc(dateOnly: string, time: string): Date {
  return fromZonedTime(`${dateOnly}T${time}:00`, FAMILY_TIMEZONE);
}

// ============ Aritmética de fecha calendario ============
// Para navegar la grilla del calendario (mes anterior/siguiente, día de
// la semana) sin depender de la zona horaria del dispositivo: operan
// sobre el string "yyyy-MM-dd" con matemática entera / Date.UTC, nunca
// con getters locales (getMonth, getDate) que dependen del navegador.

export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function addMonthsToDateOnly(dateOnly: string, months: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = ((total % 12) + 12) % 12;
  const daysInNewMonth = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
  const newDay = Math.min(d, daysInNewMonth);
  return `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

export function dayOfWeekOfDateOnly(dateOnly: string): number {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonthOfDateOnly(dateOnly: string): number {
  const [y, m] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Inversa de dateOnlyToFamilyMidnightUtc: dado un timestamptz (guardado
 * como medianoche de Asunción), devuelve la fecha calendario
 * "yyyy-MM-dd" tal como la vería la familia. Sirve tanto para eventos
 * all_day como para birth_date (columna `date`, sin componente horario,
 * que Postgres siempre devuelve como "yyyy-MM-dd").
 */
export function dateOnlyInFamilyTimezone(date: string | Date): string {
  return formatInTimeZone(date, FAMILY_TIMEZONE, "yyyy-MM-dd");
}
