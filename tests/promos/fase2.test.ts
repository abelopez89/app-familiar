import { describe, expect, it } from "vitest";
import { fechaGnb, htmlATexto, prefiltrarGnb, textoGnb, type GnbBenefit } from "@/lib/promos/gnb";
import { filtrarPromo, filtrarPromos } from "@/lib/promos/filtrado";
import type { PromoNormalizada } from "@/lib/promos/esquema";
import { describirComponente, describirTopes, vencePronto } from "@/lib/promos/formato";
import { basaFarmacenter } from "../fixtures/promos/esperadas";

// Entradas sintéticas con la forma de los campos que documenta la API de
// GNB (id, title, miniDescription, circleText…): prueban las reglas del
// prefiltro, no una respuesta real de la API.
const gnb = (b: Partial<GnbBenefit>): GnbBenefit => ({ id: 1, title: "", miniDescription: "", circleText: "", ...b });

describe("prefiltro de GNB (sin Claude)", () => {
  it("un porcentaje en el círculo pasa", () => {
    expect(prefiltrarGnb(gnb({ circleText: "-20%" })).pasa).toBe(true);
    expect(prefiltrarGnb(gnb({ circleText: "25 %" })).pasa).toBe(true);
  });

  it("solo cuotas, x2 y sorteos se descartan", () => {
    expect(prefiltrarGnb(gnb({ circleText: "12 cuotas" }))).toEqual({ pasa: false, motivo: "solo cuotas" });
    expect(prefiltrarGnb(gnb({ circleText: "x2" })).pasa).toBe(false);
    expect(prefiltrarGnb(gnb({ circleText: "Sorteo" })).pasa).toBe(false);
  });

  it('"Off y Cuotas" pasa solo con % o monto en la mini descripción', () => {
    expect(prefiltrarGnb(gnb({ circleText: "Off y Cuotas", miniDescription: "15% off y 6 cuotas" })).pasa).toBe(true);
    expect(prefiltrarGnb(gnb({ circleText: "Off y Cuotas", miniDescription: "Hasta Gs. 500.000 off" })).pasa).toBe(true);
    expect(prefiltrarGnb(gnb({ circleText: "Off y Cuotas", miniDescription: "Hasta 18 cuotas" })).pasa).toBe(false);
  });

  it("un círculo desconocido pasa solo si el texto trae un % o un monto", () => {
    expect(prefiltrarGnb(gnb({ circleText: "Nuevo", title: "20% en Farmacia X" })).pasa).toBe(true);
    expect(prefiltrarGnb(gnb({ circleText: "Nuevo", title: "Beneficio exclusivo" })).pasa).toBe(false);
  });

  it("fechas y HTML", () => {
    expect(fechaGnb("2026-11-01T00:00:00Z")).toBe("2026-11-01");
    expect(fechaGnb("01/11/2026")).toBe("2026-11-01");
    expect(fechaGnb("mañana")).toBeNull();
    expect(htmlATexto("<p>Aplica los <b>jueves</b></p><ul><li>Visa</li><li>Mastercard</li></ul>")).toBe(
      "Aplica los jueves\n• Visa\n• Mastercard",
    );
    expect(textoGnb(gnb({ title: "Súper", startDate: "2026-11-01" }))).toContain("Vigencia según la API: 2026-11-01 a ?");
  });
});

const base: PromoNormalizada = {
  titulo: "Cadena Real",
  resumen: "20% de reintegro el primer viernes",
  rubro: "supermercado",
  canal: "POS Bancard",
  acumulable: null,
  vigencia_desde: "2026-07-01",
  vigencia_hasta: "2026-12-31",
  comercios: [{ nombre: "Real", desde: null, hasta: null }],
  beneficios: [
    {
      nombre: "General",
      dias_semana: null,
      fechas: ["2026-07-03", "2026-02-30"],
      prioridad: 0,
      componentes: [
        {
          tipo: "reintegro",
          porcentaje: 20,
          monto: null,
          cuotas: null,
          es_hasta: false,
          alcance: null,
          tope_monto: 1_500_000,
          tope_periodo: "mes",
          tope_alcance: "por cuenta",
        },
      ],
      tarjetas: [{ regla: "incluye", marca: "MasterCard", nivel: null, afinidad: null, tipo: "credito" }],
    },
    {
      nombre: "Cuotas electro",
      dias_semana: [0, 1, 2, 3, 4, 5, 6, 9],
      fechas: null,
      prioridad: 0,
      componentes: [
        {
          tipo: "cuotas",
          porcentaje: null,
          monto: null,
          cuotas: 12,
          es_hasta: true,
          alcance: "electrodomésticos",
          tope_monto: null,
          tope_periodo: null,
          tope_alcance: null,
        },
      ],
      tarjetas: [],
    },
  ],
};

describe("filtrado después de Claude", () => {
  it("descarta la capa que es solo cuotas y sanea fechas y reglas", () => {
    const r = filtrarPromo(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [promo] = r.promos;
    expect(promo.beneficios).toHaveLength(1);
    expect(promo.beneficios[0].fechas).toEqual(["2026-07-03"]);
    expect(promo.beneficios[0].tarjetas[0].marca).toBe("mastercard");
  });

  it("rubro otro se descarta", () => {
    expect(filtrarPromo({ ...base, rubro: "otro" })).toEqual({ ok: false, motivo: "rubro fuera de alcance" });
  });

  it("una promo de solo cuotas se descarta con motivo", () => {
    const r = filtrarPromos([{ ...base, beneficios: [base.beneficios[1]] }]);
    expect(r).toEqual({ ok: false, motivo: "sin descuento (solo cuotas, sorteo o puntos)" });
  });

  it("días fuera de rango se descartan", () => {
    const r = filtrarPromo({ ...base, beneficios: [{ ...base.beneficios[0], dias_semana: [5, 9, 5], fechas: null }] });
    expect(r.ok && r.promos[0].beneficios[0].dias_semana).toEqual([5]);
  });
});

describe("textos de los beneficios", () => {
  it("Farmacenter, capa General", () => {
    const capa = basaFarmacenter.beneficios[0];
    expect(capa.componentes.map(describirComponente)).toEqual([
      "25% en caja (productos seleccionados, excepto medicamentos)",
      "20% en caja (medicamentos)",
      "10% reintegro",
      "hasta 6 cuotas sin intereses",
    ]);
    const [tope] = describirTopes(capa.componentes);
    expect(tope).toMatch(/^tope Gs\.\s2\.000\.000\/mes$/);
  });

  it("vence pronto: 7 días o menos", () => {
    expect(vencePronto("2026-11-06", "2026-10-30")).toBe(true);
    expect(vencePronto("2026-11-07", "2026-10-30")).toBe(false);
    expect(vencePronto("2026-10-29", "2026-10-30")).toBe(false);
    expect(vencePronto(null, "2026-10-30")).toBe(false);
  });
});
