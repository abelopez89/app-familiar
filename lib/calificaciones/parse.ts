/**
 * Lectura del "Informe cuantitativo" mensual del colegio, a partir del
 * texto del PDF (lo extrae `unpdf` en `leer.ts`). Puro y sin dependencias,
 * con tests en `tests/calificaciones/`. El resultado va a una vista previa
 * editable: lo que no se pueda leer queda vacío o con un aviso, y la
 * persona lo corrige antes de guardar.
 *
 * Formato del informe (una línea por materia, el puntaje al final):
 *   Mes: Agosto
 *   Matemática Continuando con su esfuerzo alcanzará los logros esperados11/14
 *   Llegadas tardías 1 4Ausencias
 * Una materia 0/0 no se evaluó ese mes y no se devuelve.
 */

export type ParsedScore = {
  subject: string;
  points: number;
  maxPoints: number;
  observations: string | null;
};

export type ParsedReport = {
  studentName: string | null;
  grade: string | null;
  year: number | null;
  month: number | null;
  lateArrivals: number | null;
  absences: number | null;
  scores: ParsedScore[];
  warnings: string[];
};

/** Materias del informe, en el orden en que vienen. */
export const KNOWN_SUBJECTS = [
  "Lengua Materna (Castellano)",
  "Segunda Lengua (Guaraní)",
  "Artes Plásticas",
  "Expresión Corporal",
  "Vida Social y Trabajo",
  "Medio Natural y Salud",
  "Educación Física",
  "Matemática",
  "Language Arts",
  "Social Studies",
  "Science",
  "Portugués",
  "Computación",
  "Steam + Robótica",
] as const;

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function monthFromName(name: string): number | null {
  const f = fold(name);
  if (f === "setiembre") return 9;
  const i = MONTH_NAMES.findIndex((m) => fold(m) === f);
  return i >= 0 ? i + 1 : null;
}

function toNumber(raw: string): number {
  return Number(raw.replace(",", "."));
}

/** Saca frases repetidas ("Logró… Logró…") y espacios de más. */
function cleanObservations(raw: string): string | null {
  const sentences = raw
    .replace(/\s+/g, " ")
    .split(/(?<=\.)\s*/)
    .map((s) => s.trim().replace(/\.$/, "").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique = sentences.filter((s) => {
    const key = fold(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length > 0 ? unique.join(". ") : null;
}

/** La materia conocida con la que empieza el texto (la más larga), y el resto. */
function splitSubject(chunk: string): { subject: string; rest: string } | null {
  const folded = fold(chunk);
  let best: string | null = null;
  for (const subject of KNOWN_SUBJECTS) {
    const fs = fold(subject);
    if ((folded === fs || folded.startsWith(fs + " ")) && (!best || fs.length > fold(best).length)) best = subject;
  }
  if (!best) return null;
  // Se corta por cantidad de palabras: los acentos pueden venir compuestos
  // distinto en el PDF y el largo en caracteres no coincidir.
  const words = best.split(" ").length;
  const rest = chunk.trim().split(/\s+/).slice(words).join(" ");
  return { subject: best, rest };
}

export function parseSchoolReport(text: string): ParsedReport {
  const warnings: string[] = [];
  const flat = text.replace(/\r/g, "");

  const monthMatch = flat.match(/Mes:\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]+)/);
  const month = monthMatch ? monthFromName(monthMatch[1]) : null;
  if (!month) warnings.push("No se pudo leer el mes.");

  const yearMatch = flat.match(/Año:\s*(\d{4})/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  if (!year) warnings.push("No se pudo leer el año.");

  const gradeMatch = flat.match(/Aula:\s*(.+?)(?=\s*(?:Alumno\/a:|Año:|Mes:)|\n|$)/);
  const grade = gradeMatch ? gradeMatch[1].trim() || null : null;

  const nameMatch = flat.match(/Alumno\/a:\s*(.+?)(?=\s*(?:Aula:|Año:|Mes:)|\n|$)/);
  const studentName = nameMatch ? nameMatch[1].trim() || null : null;

  // Las materias van entre "Mes: X" y el pie (web del colegio o asistencia).
  const start = monthMatch ? flat.indexOf(monthMatch[0]) + monthMatch[0].length : 0;
  const endCandidates = [flat.indexOf("www.", start), flat.indexOf("Llegadas tard", start)].filter((i) => i >= 0);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : flat.length;
  const body = flat.slice(start, end).replace(/\s+/g, " ");

  const scores: ParsedScore[] = [];
  const re = /(.*?)(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g;
  for (const m of body.matchAll(re)) {
    const chunk = m[1].trim();
    const points = toNumber(m[2]);
    const maxPoints = toNumber(m[3]);
    if (!chunk) continue;
    const split = splitSubject(chunk);
    const subject = split?.subject ?? chunk;
    if (!split) warnings.push(`Materia no reconocida: "${chunk}". Revisá el nombre.`);
    if (maxPoints === 0) continue;
    if (points > maxPoints) warnings.push(`${subject}: ${points}/${maxPoints} tiene más puntos que el máximo.`);
    scores.push({ subject, points, maxPoints, observations: split ? cleanObservations(split.rest) : null });
  }
  if (scores.length === 0) warnings.push("No se encontró ningún puntaje en el informe.");

  // "Llegadas tardías 1 4Ausencias" (orden de unpdf) o "Llegadas tardías 1 Ausencias 4".
  // Sin números después del rótulo, es cero.
  let lateArrivals: number | null = null;
  let absences: number | null = null;
  const att = flat.match(/Llegadas tard[ií]as([^A-Za-z]*)(Ausencias)?[ \t]*(\d+)?/);
  if (att) {
    const before = (att[1].match(/\d+/g) ?? []).map(Number);
    const after = att[3] !== undefined ? Number(att[3]) : null;
    if (after !== null) {
      lateArrivals = before[0] ?? 0;
      absences = after;
    } else if (before.length === 2) {
      [lateArrivals, absences] = before;
    } else if (before.length === 0) {
      lateArrivals = 0;
      absences = 0;
    } else {
      warnings.push("No se pudo distinguir llegadas tardías de ausencias. Revisalas.");
    }
  }

  return { studentName, grade, year, month, lateArrivals, absences, scores, warnings };
}
