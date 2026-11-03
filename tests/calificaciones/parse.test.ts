import { describe, expect, it } from "vitest";
import { parseSchoolReport } from "@/lib/calificaciones/parse";

// Texto tal como lo devuelve unpdf para dos informes reales (agosto y
// marzo), con el nombre del alumno reemplazado.
const AGOSTO =
  "ObservacionesPuntos logradosÁreas\nAula: 2DO GRADO AAlumno/a: ALUMNO DE PRUEBA Año: 2026\nINFORME CUANTITATIVO PRIMER CICLO\nLOS LAURELES EDUCATIONAL CENTER\nAntonio Taboada Nº 5820 esq. Alas Paraguayas\ninfo@cel.edu.py\nTeléfono: (021) 610-236 y (021) 612-617\nMes: Agosto\nLengua Materna (Castellano) Logró las capacidades planteadas11/12\nSegunda Lengua (Guaraní) Logró las capacidades planteadas10/10\nArtes Plásticas Logró las capacidades planteadas6/6\nExpresión Corporal Logró las capacidades planteadas5/5\nVida Social y Trabajo Logró las capacidades planteadas12/12\nMedio Natural y Salud Logró las capacidades planteadas8/12\nEducación Física Logró las capacidades planteadas. Participa activamente en clase15/15\nMatemática Continuando con su esfuerzo alcanzará los logros esperados. Logró las capacidades planteadas11/14\nLanguage Arts Debe prestar atención a las explicaciones del profesor/a. Continuando con su esfuerzo alcanzará los\nlogros esperados\n10/13\nSocial Studies Continuando con su esfuerzo alcanzará los logros esperados. Debe prestar atención a las explicaciones\ndel profesor/a\n12/13\nScience Continuando con su esfuerzo alcanzará los logros esperados. Debe prestar atención a las explicaciones\ndel profesor/a\n11/13\nPortugués Las capacidades planteadas no han sido logradas.10/15\nComputación Participa activamente en clase12/12\nSteam + Robótica Colabora con el trabajo de grupo20/20\nwww.cel.edu.py\ninfo@cel.edu.py\nTeléfonos 619911 / 610236 / 612617 / 661861\nSoporte Técnico 0984-615000 / 0971-591026\nSoporte Administrativo 0972-615000\nLlegadas tardías 1 4Ausencias";

const MAYO_PARCIAL =
  "Aula: 2DO GRADO AAlumno/a: ALUMNO DE PRUEBA Año: 2026\nMes: Mayo\nLengua Materna (Castellano) 34/42\nArtes Plásticas 0/0\nPortugués Logró las capacidades planteadas. Logró las capacidades planteadas. Logró las capacidades planteadas10/10\nSteam + Robótica 0/0\nwww.cel.edu.py\nTeléfonos 619911 / 610236\nLlegadas tardías Ausencias";

describe("parseSchoolReport", () => {
  it("lee encabezado, materias, observaciones y asistencia", () => {
    const r = parseSchoolReport(AGOSTO);
    expect(r.month).toBe(8);
    expect(r.year).toBe(2026);
    expect(r.grade).toBe("2DO GRADO A");
    expect(r.studentName).toBe("ALUMNO DE PRUEBA");
    expect(r.scores).toHaveLength(14);
    expect(r.warnings).toEqual([]);
    expect(r.scores.find((s) => s.subject === "Matemática")).toMatchObject({ points: 11, maxPoints: 14 });
    expect(r.scores.find((s) => s.subject === "Portugués")).toEqual({
      subject: "Portugués",
      points: 10,
      maxPoints: 15,
      observations: "Las capacidades planteadas no han sido logradas",
    });
    expect(r.scores.find((s) => s.subject === "Language Arts")?.observations).toBe(
      "Debe prestar atención a las explicaciones del profesor/a. Continuando con su esfuerzo alcanzará los logros esperados",
    );
    expect(r.lateArrivals).toBe(1);
    expect(r.absences).toBe(4);
  });

  it("saltea las materias 0/0, deduplica observaciones y toma la asistencia vacía como cero", () => {
    const r = parseSchoolReport(MAYO_PARCIAL);
    expect(r.month).toBe(5);
    expect(r.scores.map((s) => s.subject)).toEqual(["Lengua Materna (Castellano)", "Portugués"]);
    expect(r.scores[0].observations).toBeNull();
    expect(r.scores[1].observations).toBe("Logró las capacidades planteadas");
    expect(r.lateArrivals).toBe(0);
    expect(r.absences).toBe(0);
  });

  it("acepta la asistencia en el orden de pdftotext", () => {
    const r = parseSchoolReport("Mes: Junio Año: 2026\nMatemática 5/6\nLlegadas tardías   2        Ausencias    3");
    expect(r.lateArrivals).toBe(2);
    expect(r.absences).toBe(3);
  });

  it("avisa lo que no reconoce en vez de inventarlo", () => {
    const r = parseSchoolReport("Mes: Brumario\nAjedrez Muy bien 4/5\nLlegadas tardías 2Ausencias");
    expect(r.month).toBeNull();
    expect(r.scores).toEqual([{ subject: "Ajedrez Muy bien", points: 4, maxPoints: 5, observations: null }]);
    expect(r.lateArrivals).toBeNull();
    expect(r.warnings.length).toBe(4);
  });
});
