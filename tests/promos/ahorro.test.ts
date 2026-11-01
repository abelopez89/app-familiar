import { describe, expect, it } from "vitest";
import {
  acumulado,
  calcularDescuento,
  claveComponente,
  seleccionPorDefecto,
  ventanaTope,
  type ComponenteConTope,
  type UsoAnterior,
} from "@/lib/promos/ahorro";

function comp(parcial: Partial<ComponenteConTope>): ComponenteConTope {
  return {
    tipo: "descuento_caja",
    porcentaje: 25,
    monto: null,
    cuotas: null,
    es_hasta: false,
    alcance: null,
    tope_monto: null,
    tope_periodo: null,
    tope_alcance: null,
    tope_tipo: null,
    ...parcial,
  };
}

describe("ventanaTope", () => {
  it("mes calendario, día y toda la promo", () => {
    expect(ventanaTope("mes", "2026-02-14")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(ventanaTope("mes", "2028-02-03")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
    expect(ventanaTope("dia", "2026-11-03")).toEqual({ desde: "2026-11-03", hasta: "2026-11-03" });
    expect(ventanaTope("promo", "2026-11-03")).toBeNull();
    expect(ventanaTope(null, "2026-11-03")).toBeNull();
  });
});

describe("calcularDescuento", () => {
  it("sin tope: porcentaje en caja y reintegro se suman", () => {
    const r = calcularDescuento({
      montoBruto: 400_000,
      componentes: [comp({ porcentaje: 20 }), comp({ tipo: "reintegro", porcentaje: 10 }), comp({ tipo: "cuotas", porcentaje: null, cuotas: 6 })],
      seleccion: [0, 1, 2],
      usosAnteriores: [],
      fecha: "2026-11-03",
    });
    expect(r.descuentoCaja).toBe(80_000);
    expect(r.reintegro).toBe(40_000);
    expect(r.montoCaja).toBe(320_000);
    expect(r.costoFinal).toBe(280_000);
    expect(r.aplicados).toHaveLength(2);
  });

  it("tope de reintegro mensual por tarjeta (Sudameris Enex: 10%, tope Gs. 600.000/mes)", () => {
    const enex = comp({ tipo: "reintegro", porcentaje: 10, tope_monto: 600_000, tope_periodo: "mes", tope_tipo: "descuento" });
    const clave = claveComponente(enex);
    const usos: UsoAnterior[] = [
      { id: "a", fecha: "2026-11-02", detalle: { beneficio: "General", aplicados: [{ clave, base: 5_000_000, descuento: 500_000 } as never] } },
      { id: "b", fecha: "2026-10-30", detalle: { beneficio: "General", aplicados: [{ clave, base: 9_000_000, descuento: 600_000 } as never] } },
    ];
    const r = calcularDescuento({ montoBruto: 2_000_000, componentes: [enex], seleccion: [0], usosAnteriores: usos, fecha: "2026-11-20" });
    expect(r.reintegro).toBe(100_000); // quedaban 100.000 de los 600.000 de noviembre
    expect(r.aplicados[0].restante).toBe(0);
    expect(r.aplicados[0].topeAlcanzado).toBe(true);
    expect(r.aplicados[0].topeDudoso).toBe(false);
  });

  it("tope de compra: el porcentaje solo se aplica hasta el tope", () => {
    const basa = comp({ porcentaje: 25, tope_monto: 1_500_000, tope_periodo: "mes", tope_tipo: "compra" });
    const clave = claveComponente(basa);
    const usos: UsoAnterior[] = [
      { id: "a", fecha: "2026-11-05", detalle: { beneficio: "General", aplicados: [{ clave, base: 1_000_000, descuento: 250_000 } as never] } },
    ];
    const r = calcularDescuento({ montoBruto: 800_000, componentes: [basa], seleccion: [0], usosAnteriores: usos, fecha: "2026-11-12" });
    expect(r.aplicados[0].base).toBe(500_000);
    expect(r.descuentoCaja).toBe(125_000);
    expect(r.montoCaja).toBe(675_000);
    expect(r.aplicados[0].restante).toBe(0);
  });

  it("tope sin tipo: se toma como tope de descuento y se marca dudoso", () => {
    const r = calcularDescuento({
      montoBruto: 1_000_000,
      componentes: [comp({ porcentaje: 30, tope_monto: 100_000, tope_periodo: "promo" })],
      seleccion: [0],
      usosAnteriores: [],
      fecha: "2026-11-12",
    });
    expect(r.descuentoCaja).toBe(100_000);
    expect(r.aplicados[0].topeDudoso).toBe(true);
  });

  it("al editar, el propio uso no cuenta para el acumulado", () => {
    const c = comp({ porcentaje: 10, tope_monto: 50_000, tope_periodo: "mes", tope_tipo: "descuento" });
    const clave = claveComponente(c);
    const usos: UsoAnterior[] = [
      { id: "este", fecha: "2026-11-05", detalle: { beneficio: "General", aplicados: [{ clave, base: 500_000, descuento: 50_000 } as never] } },
    ];
    expect(acumulado(usos, clave, "mes", "2026-11-05", "este")).toEqual({ base: 0, descuento: 0 });
    const r = calcularDescuento({ montoBruto: 500_000, componentes: [c], seleccion: [0], usosAnteriores: usos, fecha: "2026-11-05", excluirId: "este" });
    expect(r.descuentoCaja).toBe(50_000);
  });

  it("monto fijo, redondeo a guaraníes y nunca más que el bruto", () => {
    const r = calcularDescuento({
      montoBruto: 100_001,
      componentes: [comp({ porcentaje: 33.33 }), comp({ tipo: "descuento_monto", porcentaje: null, monto: 90_000 })],
      seleccion: [0, 1],
      usosAnteriores: [],
      fecha: "2026-11-05",
    });
    expect(r.aplicados[0].descuento).toBe(33_330);
    expect(r.descuentoCaja).toBe(100_001);
    expect(r.montoCaja).toBe(0);
  });

  it("los componentes con alcance no se aplican por defecto", () => {
    const comps = [comp({ porcentaje: 25, alcance: "excepto medicamentos" }), comp({ porcentaje: 20 }), comp({ tipo: "cuotas", porcentaje: null, cuotas: 3 })];
    expect(seleccionPorDefecto(comps)).toEqual([1]);
  });
});
