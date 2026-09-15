import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import {
  FAMILY_TIMEZONE,
  dateOnlyInFamilyTimezone,
  dateOnlyToFamilyMidnightUtc,
  dateTimeToFamilyUtc,
} from "@/lib/dates";
import { EVENT_CATEGORIES } from "@/lib/events/constants";
import type { EventWithDetails } from "@/lib/events/queries";
import type { FamilyMember } from "@/lib/supabase/types";

const CRLF = "\r\n";

/**
 * Escapa \, ; , y saltos de línea en SUMMARY/DESCRIPTION/LOCATION, según
 * RFC 5545. Sin esto el parseo se rompe apenas un evento tiene una coma
 * o un punto y coma en el título.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folding a 75 octetos (RFC 5545): las líneas largas se cortan y
 * continúan con un espacio al inicio de la línea siguiente. Corta por
 * bytes UTF-8, no por caracteres, para no partir un carácter multibyte
 * a la mitad (tildes, ñ).
 */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // No partir un carácter multibyte: retroceder mientras el byte sea
    // una continuación UTF-8 (10xxxxxx).
    while (end < bytes.length && end > start && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // la continuación agrega 1 espacio, así que el contenido son 74 octetos
  }

  return chunks.join(CRLF + " ");
}

function formatUtcStamp(date: Date): string {
  return formatInTimeZone(date, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

function formatLocalDateTime(date: Date): string {
  return formatInTimeZone(date, FAMILY_TIMEZONE, "yyyyMMdd'T'HHmmss");
}

function formatDateOnly(dateOnly: string): string {
  return dateOnly.replace(/-/g, "");
}

type IcsAlarm = { offsetMinutes: number; description: string };

type IcsVevent = {
  uid: string;
  dtstamp: Date;
  lastModified: Date;
  sequence: number;
  summary: string;
  description?: string | null;
  location?: string | null;
  categories: string;
  allDay: boolean;
  dtstart: Date;
  dtend: Date | null;
  rrule?: string | null;
  alarms: IcsAlarm[];
};

function buildVevent(ev: IcsVevent): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];

  lines.push(`UID:${ev.uid}`);
  lines.push(`DTSTAMP:${formatUtcStamp(ev.dtstamp)}`);
  lines.push(`LAST-MODIFIED:${formatUtcStamp(ev.lastModified)}`);
  lines.push(`SEQUENCE:${ev.sequence}`);

  if (ev.allDay) {
    const startDay = dateOnlyInFamilyTimezone(ev.dtstart);
    // DTEND es exclusivo: siempre un día más que el día del evento.
    const endDate = new Date(ev.dtstart.getTime() + 24 * 60 * 60 * 1000);
    const endDay = dateOnlyInFamilyTimezone(endDate);
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(startDay)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateOnly(endDay)}`);
  } else {
    lines.push(`DTSTART;TZID=${FAMILY_TIMEZONE}:${formatLocalDateTime(ev.dtstart)}`);
    if (ev.dtend) {
      lines.push(`DTEND;TZID=${FAMILY_TIMEZONE}:${formatLocalDateTime(ev.dtend)}`);
    }
  }

  lines.push(`SUMMARY:${escapeIcsText(ev.summary)}`);
  if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
  lines.push(`CATEGORIES:${ev.categories}`);
  if (ev.rrule) lines.push(`RRULE:${ev.rrule}`);

  for (const alarm of ev.alarms) {
    lines.push("BEGIN:VALARM");
    lines.push(`TRIGGER:-PT${alarm.offsetMinutes}M`);
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeIcsText(alarm.description)}`);
    lines.push("END:VALARM");
  }

  lines.push("END:VEVENT");
  return lines;
}

function buildRrule(
  recurrence: "weekly" | "monthly" | "yearly",
  recurrenceUntil: string | null,
): string {
  const freq = { weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" }[recurrence];
  if (!recurrenceUntil) return `FREQ=${freq}`;
  const untilUtc = dateTimeToFamilyUtc(recurrenceUntil, "23:59:59");
  return `FREQ=${freq};UNTIL=${formatUtcStamp(untilUtc)}`;
}

/**
 * Genera el feed ICS completo de una familia. Función pura: recibe los
 * datos ya resueltos (eventos + miembros), no hace ninguna consulta acá
 * — eso es responsabilidad de quien la llama (ver lib/calendar-feed.ts,
 * que usa el admin client porque este feed se sirve sin sesión).
 *
 * No expande recurrencias: emite un solo VEVENT por evento/cumpleaños
 * con su RRULE, y es el cliente de calendario (Apple/Google) el que hace
 * la expansión — es el modelo estándar de ICS.
 */
export function generateIcsCalendar(params: {
  familyName: string;
  events: EventWithDetails[];
  members: FamilyMember[];
  now?: Date;
}): string {
  const now = params.now ?? new Date();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//App Familiar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`Familia ${params.familyName}`)}`,
    `X-WR-TIMEZONE:${FAMILY_TIMEZONE}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const event of params.events) {
    const calendarReminders = event.reminders.filter((r) => r.channel === "calendar");
    const updatedAt = new Date(event.updated_at);

    lines.push(
      ...buildVevent({
        uid: `${event.id}@app-familiar`,
        dtstamp: now,
        lastModified: updatedAt,
        sequence: Math.floor(updatedAt.getTime() / 1000),
        summary: event.title,
        description: event.description,
        location: event.location,
        categories: EVENT_CATEGORIES[event.category].label.toUpperCase(),
        allDay: event.all_day,
        dtstart: new Date(event.starts_at),
        dtend: event.ends_at ? new Date(event.ends_at) : null,
        rrule: event.recurrence ? buildRrule(event.recurrence, event.recurrence_until) : null,
        alarms: calendarReminders.map((r) => ({
          offsetMinutes: r.offset_minutes,
          description: event.title,
        })),
      }),
    );
  }

  for (const member of params.members) {
    if (!member.birth_date) continue;

    lines.push(
      ...buildVevent({
        uid: `cumpleanos-${member.id}@app-familiar`,
        dtstamp: now,
        lastModified: now,
        sequence: 0,
        summary: `Cumpleaños de ${member.display_name}`,
        categories: EVENT_CATEGORIES.cumpleanos.label.toUpperCase(),
        allDay: true,
        dtstart: dateOnlyToFamilyMidnightUtc(member.birth_date),
        dtend: null,
        rrule: buildRrule("yearly", null),
        alarms: [],
      }),
    );
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
