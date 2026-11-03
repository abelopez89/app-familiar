/**
 * Resumen de calificaciones de un hijo en un año: por materia y por mes.
 * Puro, con tests en `tests/calificaciones/`. El acumulado es la suma de
 * puntos sobre la suma de máximos (no el promedio de los porcentajes de
 * cada mes): un mes con 42 puntos posibles pesa más que uno con 5, igual
 * que en el informe del colegio.
 */

export type InformeResumen = {
  id: string;
  documentId: string | null;
  year: number;
  month: number;
  lateArrivals: number | null;
  absences: number | null;
  scores: { subject: string; sortOrder: number; points: number; maxPoints: number; observations: string | null }[];
};

export type Celda = { points: number; maxPoints: number; pct: number; observations: string | null };

export type MateriaResumen = {
  subject: string;
  /** Una por mes de `meses`, en el mismo orden; null = no se evaluó. */
  celdas: (Celda | null)[];
  points: number;
  maxPoints: number;
  pct: number;
  /** Último mes evaluado contra el anterior evaluado, en puntos porcentuales. */
  variacion: number | null;
};

export type ResumenAnio = {
  meses: number[];
  materias: MateriaResumen[];
  /** Total del mes (todas las materias evaluadas), alineado con `meses`. */
  totalesMes: ({ points: number; maxPoints: number; pct: number } | null)[];
  total: { points: number; maxPoints: number; pct: number } | null;
  llegadasTardias: number;
  ausencias: number;
};

/** Una baja de al menos esto (en puntos porcentuales) se marca en el resumen. */
export const BAJA_DESTACADA = 10;

function pct(points: number, maxPoints: number): number {
  return maxPoints > 0 ? (points / maxPoints) * 100 : 0;
}

export function resumirAnio(informes: InformeResumen[]): ResumenAnio {
  const ordenados = [...informes].sort((a, b) => a.month - b.month);
  const meses = ordenados.map((i) => i.month);

  // Orden de las materias: el del informe (sort_order) del primer mes en
  // que aparecen; las nuevas de meses posteriores van al final.
  const orden: string[] = [];
  for (const informe of ordenados) {
    for (const s of [...informe.scores].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (!orden.includes(s.subject)) orden.push(s.subject);
    }
  }

  const materias: MateriaResumen[] = orden.map((subject) => {
    const celdas = ordenados.map((informe) => {
      const s = informe.scores.find((x) => x.subject === subject);
      return s
        ? { points: s.points, maxPoints: s.maxPoints, pct: pct(s.points, s.maxPoints), observations: s.observations }
        : null;
    });
    const evaluadas = celdas.filter((c): c is Celda => c !== null);
    const points = evaluadas.reduce((t, c) => t + c.points, 0);
    const maxPoints = evaluadas.reduce((t, c) => t + c.maxPoints, 0);
    const variacion =
      evaluadas.length >= 2 ? evaluadas[evaluadas.length - 1].pct - evaluadas[evaluadas.length - 2].pct : null;
    return { subject, celdas, points, maxPoints, pct: pct(points, maxPoints), variacion };
  });

  const totalesMes = ordenados.map((informe) => {
    if (informe.scores.length === 0) return null;
    const points = informe.scores.reduce((t, s) => t + s.points, 0);
    const maxPoints = informe.scores.reduce((t, s) => t + s.maxPoints, 0);
    return { points, maxPoints, pct: pct(points, maxPoints) };
  });

  const points = materias.reduce((t, m) => t + m.points, 0);
  const maxPoints = materias.reduce((t, m) => t + m.maxPoints, 0);

  return {
    meses,
    materias,
    totalesMes,
    total: maxPoints > 0 ? { points, maxPoints, pct: pct(points, maxPoints) } : null,
    llegadasTardias: ordenados.reduce((t, i) => t + (i.lateArrivals ?? 0), 0),
    ausencias: ordenados.reduce((t, i) => t + (i.absences ?? 0), 0),
  };
}

/** "11/14" o "10,5/12": los puntos casi siempre son enteros. */
export function formatPuntos(points: number, maxPoints: number): string {
  const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
  return `${f(points)}/${f(maxPoints)}`;
}
