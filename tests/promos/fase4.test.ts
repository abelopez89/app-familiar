import { describe, expect, it } from "vitest";
import { existenteEsMasNueva } from "@/lib/promos/versiones";
import { beneficiosDeJsonGnb, totalPaginasGnb } from "@/lib/promos/gnb";

describe("versionado de promos manuales", () => {
  it("compara primero la vigencia", () => {
    expect(
      existenteEsMasNueva(
        { vigencia_hasta: "2026-12-31", version_doc: null },
        { vigencia_hasta: "2026-09-30", version_doc: null },
      ),
    ).toBe(true);
    expect(
      existenteEsMasNueva(
        { vigencia_hasta: "2026-09-30", version_doc: null },
        { vigencia_hasta: "2026-12-31", version_doc: null },
      ),
    ).toBe(false);
  });

  it("con la misma vigencia, la fecha o el número de versión del documento", () => {
    const base = { vigencia_hasta: "2026-12-31" };
    expect(
      existenteEsMasNueva({ ...base, version_doc: "V1 – 30/09/2026" }, { ...base, version_doc: "V1 – 15/10/2026" }),
    ).toBe(false);
    expect(existenteEsMasNueva({ ...base, version_doc: "V3" }, { ...base, version_doc: "V2" })).toBe(true);
    expect(existenteEsMasNueva({ ...base, version_doc: null }, { ...base, version_doc: null })).toBe(false);
  });
});

describe("JSON de GNB pegado a mano", () => {
  it("encuentra los beneficios con distintos envoltorios", () => {
    const b = { id: 1, title: "x" };
    expect(beneficiosDeJsonGnb({ data: [b] })).toEqual([b]);
    expect(beneficiosDeJsonGnb({ benefits: [b] })).toEqual([b]);
    expect(beneficiosDeJsonGnb([b, { title: "sin id" }])).toEqual([b]);
    expect(beneficiosDeJsonGnb({ otra: [] })).toEqual([]);
    expect(beneficiosDeJsonGnb("texto")).toEqual([]);
  });

  it("lee el total de páginas si viene", () => {
    expect(totalPaginasGnb({ pagination: { totalPages: 2 } })).toBe(2);
    expect(totalPaginasGnb({ data: [] })).toBeNull();
  });
});
