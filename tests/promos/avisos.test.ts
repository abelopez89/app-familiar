import { describe, expect, it } from "vitest";
import {
  armarMensaje,
  avisoVencimientos,
  avisoVispera,
  promosPorVencer,
  resumenDelDia,
  resumenSemanal,
  type PromoAviso,
  type TarjetaAviso,
} from "@/lib/promos/avisos";

// 2026-11-02 es lunes; 2026-11-03, martes.
const HOY = "2026-11-02";
const PIE = "Más en la app";

function promo(parcial: Partial<PromoAviso> & Pick<PromoAviso, "id">): PromoAviso {
  return {
    banco: "sudameris",
    activa: true,
    vigencia_desde: null,
    vigencia_hasta: null,
    titulo: "Promo",
    rubro: "supermercado",
    origen: "web",
    comercios: [],
    beneficios: [
      {
        nombre: "General",
        dias_semana: [1],
        fechas: null,
        prioridad: 0,
        componentes: [
          {
            tipo: "descuento_caja",
            porcentaje: 25,
            monto: null,
            cuotas: null,
            es_hasta: false,
            alcance: null,
            tope_monto: null,
            tope_periodo: null,
            tope_alcance: null,
          },
        ],
        tarjetas: [],
      },
    ],
    ...parcial,
  };
}

const TARJETA: TarjetaAviso = {
  id: "t1",
  alias: "Visa de Abel",
  member_id: "m1",
  banco: "sudameris",
  marca: "visa",
  nivel: "oro",
  afinidad: null,
  tipo: "credito",
};
const NOMBRES = new Map([["m1", "Abel"]]);

describe("resumenDelDia", () => {
  it("lista por rubro con la tarjeta y su dueño, escapando el HTML", () => {
    const texto = resumenDelDia(
      [promo({ id: "p1", comercios: [{ comercio_nombre: "Stock & Co", desde: null, hasta: null }] })],
      [TARJETA],
      HOY,
      NOMBRES,
      PIE,
    );
    expect(texto).toContain("lunes 02/11");
    expect(texto).toContain("🛒 <b>Supermercado</b>");
    expect(texto).toContain("<b>Stock &amp; Co</b> — 25% en caja · Visa de Abel (Abel)");
    expect(texto?.endsWith(PIE)).toBe(true);
  });

  it("no manda nada si ninguna promo vale hoy para las tarjetas", () => {
    expect(resumenDelDia([promo({ id: "p1", banco: "itau" })], [TARJETA], HOY, NOMBRES, PIE)).toBeNull();
    expect(resumenDelDia([promo({ id: "p1" })], [TARJETA], "2026-11-03", NOMBRES, PIE)).toBeNull();
  });
});

describe("avisoVispera", () => {
  it("avisa solo las que mañana valen por una fecha puntual", () => {
    const porFecha = promo({ id: "p1", titulo: "Enex primer martes" });
    porFecha.beneficios[0] = { ...porFecha.beneficios[0], dias_semana: [], fechas: ["2026-11-03"] };
    const semanal = promo({ id: "p2", titulo: "Todos los martes" });
    semanal.beneficios[0] = { ...semanal.beneficios[0], dias_semana: [2] };

    const texto = avisoVispera([porFecha, semanal], [TARJETA], HOY, NOMBRES, PIE);
    expect(texto).toContain("martes 03/11");
    expect(texto).toContain("Enex primer martes");
    expect(texto).not.toContain("Todos los martes");
    expect(avisoVispera([semanal], [TARJETA], HOY, NOMBRES, PIE)).toBeNull();
  });
});

describe("vencimientos", () => {
  it("solo las manuales que le sirven a la familia y vencen en 7 días o menos", () => {
    const promos = [
      promo({ id: "manual-pronto", origen: "manual", vigencia_hasta: "2026-11-09" }),
      promo({ id: "manual-lejos", origen: "manual", vigencia_hasta: "2026-11-10" }),
      promo({ id: "web-pronto", origen: "web", vigencia_hasta: "2026-11-05" }),
      promo({ id: "otro-banco", origen: "manual", vigencia_hasta: "2026-11-05", banco: "itau" }),
    ];
    expect(promosPorVencer(promos, [TARJETA], HOY).map((p) => p.id)).toEqual(["manual-pronto"]);
  });

  it("dice cuándo vence", () => {
    const texto = avisoVencimientos(
      [
        promo({ id: "a", titulo: "A", origen: "manual", vigencia_hasta: "2026-11-09" }),
        promo({ id: "b", titulo: "B", origen: "manual", vigencia_hasta: HOY }),
      ],
      HOY,
      PIE,
    );
    expect(texto).toContain("<b>B</b> — vence hoy");
    expect(texto).toContain("<b>A</b> — vence el 09/11 (en 7 días)");
    expect(texto!.indexOf("<b>B</b>")).toBeLessThan(texto!.indexOf("<b>A</b>"));
    expect(avisoVencimientos([], HOY, PIE)).toBeNull();
  });
});

describe("resumenSemanal y armarMensaje", () => {
  it("agrupa los próximos 7 días y saltea los vacíos", () => {
    const texto = resumenSemanal([promo({ id: "p1", titulo: "Súper" })], [TARJETA], HOY, PIE);
    expect(texto).toContain("<b>lunes 02/11</b>: Súper (25%)");
    expect(texto).not.toContain("09/11"); // hoy y los 6 días siguientes
    expect(texto).not.toContain("martes");
  });

  it("corta lo que no entra en un mensaje de Telegram", () => {
    const lineas = Array.from({ length: 200 }, (_, i) => `línea ${i} ${"x".repeat(40)}`);
    const texto = armarMensaje("Encabezado", lineas, PIE);
    expect(texto.length).toBeLessThan(4096);
    expect(texto).toMatch(/… y \d+ más en la app/);
    expect(texto.endsWith(PIE)).toBe(true);
  });
});
