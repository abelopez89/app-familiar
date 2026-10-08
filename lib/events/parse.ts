import { addDaysToDateOnly, dayOfWeekOfDateOnly } from "@/lib/dates";

// Interpreta un evento escrito en una sola línea, como se escribe en el
// chat: "Dentista jueves 15:30", "Cumple de Ana 20/10", "Reunión de
// padres mañana a las 19", "Fútbol sábado de 10 a 12".
//
// Función pura, sin zona horaria propia: recibe "hoy" como fecha
// calendario de la familia ("yyyy-MM-dd", `todayInFamilyTimezone()`) y
// devuelve fecha y hora como texto, para que quien llama las convierta
// con `dateOnlyToFamilyMidnightUtc` / `dateTimeToFamilyUtc` (la regla de
// fechas de la Fase 2: nunca `new Date(...)` del dispositivo).
//
// Lo que no entiende lo deja en el título. Mejor un título con una
// palabra de más (que la persona ve en la confirmación) que adivinar.

export type ParsedEventText = {
  title: string;
  /** "yyyy-MM-dd", o null si el texto no dice el día. */
  date: string | null;
  /** "HH:mm", o null si no dice hora (evento de todo el día). */
  time: string | null;
  endTime: string | null;
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTHS = [
  ["enero", "ene"],
  ["febrero", "feb"],
  ["marzo", "mar"],
  ["abril", "abr"],
  ["mayo", "may"],
  ["junio", "jun"],
  ["julio", "jul"],
  ["agosto", "ago"],
  ["septiembre", "setiembre", "sep", "set"],
  ["octubre", "oct"],
  ["noviembre", "nov"],
  ["diciembre", "dic"],
];
const MONTH_PATTERN = MONTHS.flat().sort((a, b) => b.length - a.length).join("|");

/**
 * Minúsculas y sin tildes, letra por letra: el texto normalizado tiene
 * exactamente el mismo largo que el original, así un tramo encontrado en
 * uno se puede recortar del otro (el título conserva tildes y mayúsculas).
 */
function normalizeSameLength(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return (base.length === 1 ? base : ch).toLowerCase();
    })
    .join("");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toTime(hour: number, minute: number): string | null {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

function validDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Día y mes sin año: este año, o el que viene si ya pasó. */
function nextDayMonth(today: string, month: number, day: number, year?: number): string | null {
  if (year !== undefined) return validDate(year < 100 ? 2000 + year : year, month, day);
  const thisYear = Number(today.slice(0, 4));
  const candidate = validDate(thisYear, month, day);
  if (candidate && candidate >= today) return candidate;
  return validDate(thisYear + 1, month, day);
}

/**
 * Próximo día de la semana pedido. Si hoy es ese día, es el de la semana
 * que viene: para hoy la gente dice "hoy".
 */
function nextWeekday(today: string, weekday: number): string {
  const diff = (weekday - dayOfWeekOfDateOnly(today) + 7) % 7;
  return addDaysToDateOnly(today, diff === 0 ? 7 : diff);
}

function hour12(hour: number, meridiem: string | undefined): number {
  if (!meridiem) return hour;
  if (meridiem === "pm" && hour < 12) return hour + 12;
  if (meridiem === "am" && hour === 12) return 0;
  return hour;
}

type Rule = { pattern: RegExp; apply: (m: RegExpExecArray) => boolean };

export function parseEventText(text: string, today: string): ParsedEventText {
  let original = text.replace(/\s+/g, " ").trim();
  let norm = normalizeSameLength(original);
  let date: string | null = null;
  let time: string | null = null;
  let endTime: string | null = null;

  /** Saca el tramo reconocido del texto (en los dos, para que sigan alineados). */
  const consume = (m: RegExpExecArray) => {
    const start = m.index;
    const end = m.index + m[0].length;
    original = `${original.slice(0, start)} ${original.slice(end)}`;
    norm = `${norm.slice(0, start)} ${norm.slice(end)}`;
  };

  const run = (rules: Rule[]) => {
    for (const rule of rules) {
      const m = rule.pattern.exec(norm);
      if (m && rule.apply(m)) {
        consume(m);
        return true;
      }
    }
    return false;
  };

  // --- Rango horario: "de 10 a 12", "15:30-17:00", "de 9:30 a 11 hs" ---
  run([
    {
      pattern: /(?<![\w/])(?:de\s+)(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?|horas)?\s+(?:a|hasta)\s+(?:las\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?|horas)?(?!\w)/,
      apply: (m) => {
        const from = toTime(Number(m[1]), Number(m[2] ?? 0));
        const to = toTime(Number(m[3]), Number(m[4] ?? 0));
        if (!from || !to || to <= from) return false;
        time = from;
        endTime = to;
        return true;
      },
    },
    {
      pattern: /(?<![\w/])(\d{1,2})[:.](\d{2})\s*(?:-|a|hasta)\s*(\d{1,2})[:.](\d{2})\s*(?:hs?|horas)?(?!\w)/,
      apply: (m) => {
        const from = toTime(Number(m[1]), Number(m[2]));
        const to = toTime(Number(m[3]), Number(m[4]));
        if (!from || !to || to <= from) return false;
        time = from;
        endTime = to;
        return true;
      },
    },
  ]);

  // --- Hora suelta ---
  if (!time) {
    run([
      {
        // "15:30", "a las 15:30", "15.30 hs"
        pattern: /(?<![\w/])(?:a\s+las?\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*(?:hs?|horas)?(?!\w)/,
        apply: (m) => (time = toTime(hour12(Number(m[1]), m[3]), Number(m[2]))) !== null,
      },
      {
        // "3pm", "10 am"
        pattern: /(?<![\w/])(?:a\s+las?\s+)?(\d{1,2})\s*(am|pm)(?!\w)/,
        apply: (m) => (time = toTime(hour12(Number(m[1]), m[2]), 0)) !== null,
      },
      {
        // "a las 19", "a la 1"
        pattern: /(?<![\w/])a\s+las?\s+(\d{1,2})\s*(?:hs?|horas)?(?!\w)/,
        apply: (m) => (time = toTime(Number(m[1]), 0)) !== null,
      },
      {
        // "19 hs", "19h", "19 horas"
        pattern: /(?<![\w/])(\d{1,2})\s*(?:hs|h|horas)(?!\w)/,
        apply: (m) => (time = toTime(Number(m[1]), 0)) !== null,
      },
      {
        pattern: /(?<!\w)(?:al\s+|a\s+)?mediodia(?!\w)/,
        apply: () => (time = "12:00") !== null,
      },
    ]);
  }

  // --- Día ---
  run([
    {
      pattern: /(?<!\w)pasado\s+manana(?!\w)/,
      apply: () => (date = addDaysToDateOnly(today, 2)) !== null,
    },
    {
      pattern: /(?<!\w)hoy(?!\w)/,
      apply: () => (date = today) !== null,
    },
    {
      pattern: /(?<!\w)manana(?!\w)/,
      apply: () => (date = addDaysToDateOnly(today, 1)) !== null,
    },
    {
      // "15/10", "15-10-2026", "el 3/11/26"
      pattern: /(?<![\w:.])(?:el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?(?![\w:/])/,
      apply: (m) =>
        (date = nextDayMonth(today, Number(m[2]), Number(m[1]), m[3] ? Number(m[3]) : undefined)) !== null,
    },
    {
      // "15 de octubre", "el 3 de nov de 2026", "15 oct"
      pattern: new RegExp(
        `(?<![\\w:.])(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_PATTERN})\\.?(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?(?!\\w)`,
      ),
      apply: (m) => {
        const month = MONTHS.findIndex((names) => names.includes(m[2])) + 1;
        return (date = nextDayMonth(today, month, Number(m[1]), m[3] ? Number(m[3]) : undefined)) !== null;
      },
    },
    {
      // "jueves", "el jueves", "este jueves", "el próximo jueves"
      pattern: new RegExp(
        `(?<!\\w)(?:(?:el|este)\\s+)?(?:proximo\\s+)?(${WEEKDAYS.join("|")})(?:\\s+proximo)?(?!\\w)`,
      ),
      apply: (m) => (date = nextWeekday(today, WEEKDAYS.indexOf(m[1]))) !== null,
    },
  ]);

  // --- Título: lo que quedó, sin conectores sueltos en los bordes ---
  let title = original.replace(/\s+/g, " ").trim();
  const edge = /^(?:el|la|los|las|de|del|a|al|para|en|y|,|-)\s+|\s+(?:el|la|los|las|de|del|a|al|para|en|y|,|-)$/i;
  while (edge.test(title)) title = title.replace(edge, "").trim();
  title = title.replace(/[\s,;-]+$/, "").trim();
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title: title.slice(0, 120), date, time, endTime };
}
