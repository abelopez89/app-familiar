import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

export const FAMILY_TIMEZONE = "America/Asuncion";

export function formatDate(date: string | Date, pattern = "d 'de' MMMM"): string {
  return formatInTimeZone(date, FAMILY_TIMEZONE, pattern, { locale: es });
}

export function formatDateTime(date: string | Date): string {
  return formatInTimeZone(date, FAMILY_TIMEZONE, "d 'de' MMMM, HH:mm", { locale: es });
}

export function todayInFamilyTimezone(): string {
  return formatInTimeZone(new Date(), FAMILY_TIMEZONE, "yyyy-MM-dd");
}
