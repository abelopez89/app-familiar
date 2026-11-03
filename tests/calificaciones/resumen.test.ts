import { describe, expect, it } from "vitest";
import { formatPuntos, resumirAnio, type InformeResumen } from "@/lib/calificaciones/resumen";

function informe(month: number, scores: [string, number, number][], extra: Partial<InformeResumen> = {}): InformeResumen {
  return {
    id: `r${month}`,
    documentId: null,
    year: 2026,
    month,
    lateArrivals: null,
    absences: null,
    scores: scores.map(([subject, points, maxPoints], i) => ({ subject, sortOrder: i, points, maxPoints, observations: null })),
    ...extra,
  };
}

describe("resumirAnio", () => {
  // Matemática y Portugués de los informes reales de marzo a agosto.
  const informes = [
    informe(8, [["Matemática", 11, 14], ["Portugués", 10, 15]], { lateArrivals: 1, absences: 4 }),
    informe(3, [["Matemática", 5, 6], ["Portugués", 8, 8]], { lateArrivals: 0, absences: 0 }),
    informe(4, [["Matemática", 12, 16], ["Portugués", 12, 12]]),
    informe(5, [["Matemática", 14, 18], ["Portugués", 10, 10]]),
    informe(6, [["Portugués", 9, 10]]),
  ];

  it("ordena los meses y acumula por suma de puntos, no por promedio de porcentajes", () => {
    const r = resumirAnio(informes);
    expect(r.meses).toEqual([3, 4, 5, 6, 8]);
    const mate = r.materias.find((m) => m.subject === "Matemática")!;
    expect(mate.points).toBe(42);
    expect(mate.maxPoints).toBe(54);
    expect(Math.round(mate.pct)).toBe(78);
    // Junio no tuvo Matemática.
    expect(mate.celdas[3]).toBeNull();
    expect(r.llegadasTardias).toBe(1);
    expect(r.ausencias).toBe(4);
  });

  it("la variación compara los dos últimos meses evaluados", () => {
    const r = resumirAnio(informes);
    const portu = r.materias.find((m) => m.subject === "Portugués")!;
    // Junio 90% → agosto 66,7%.
    expect(Math.round(portu.variacion!)).toBe(-23);
    const mate = r.materias.find((m) => m.subject === "Matemática")!;
    // Mayo 77,8% → agosto 78,6% (junio no cuenta).
    expect(mate.variacion!).toBeGreaterThan(0);
  });

  it("totales por mes y del año", () => {
    const r = resumirAnio(informes);
    expect(r.totalesMes[0]).toEqual({ points: 13, maxPoints: 14, pct: (13 / 14) * 100 });
    expect(r.total!.points).toBe(42 + 49);
    expect(resumirAnio([]).total).toBeNull();
  });

  it("formatea puntos con coma decimal", () => {
    expect(formatPuntos(11, 14)).toBe("11/14");
    expect(formatPuntos(10.5, 12)).toBe("10,5/12");
  });
});
