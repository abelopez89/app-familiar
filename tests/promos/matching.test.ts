import { describe, expect, it } from "vitest";
import { tarjetasQueAplican } from "@/lib/promos/matching";
import { describirDias, describirOrigen } from "@/lib/promos/formato";
import {
  beneficioDelDia,
  comerciosVigentes,
  promosQueAplican,
  tarjetaAplica,
  type TarjetaParaMatch,
} from "@/lib/promos/matching";
import {
  FECHAS_ESPECIALES_FARMACENTER,
  basaFarmacenter,
  basaJuevesSuper,
  mcClasicaFarmacenter,
  mcOroTarjetaB,
  sudamerisCadenaReal,
} from "../fixtures/promos/esperadas";

// Noviembre de 2026: martes 3 y 10, miércoles 11, jueves 5, viernes 6 y 13.
const MARTES = "2026-11-03";
const MARTES_ESPECIAL = "2026-11-10";
const MIERCOLES = "2026-11-11";
const JUEVES = "2026-11-05";
const PRIMER_VIERNES = "2026-11-06";
const SEGUNDO_VIERNES = "2026-11-13";

const sudamerisVisaCredito: TarjetaParaMatch = {
  banco: "sudameris",
  marca: "visa",
  nivel: "clasica",
  afinidad: null,
  tipo: "credito",
};

describe("reglas de inclusión y exclusión", () => {
  it("la exclusión gana aunque otra regla incluya la tarjeta", () => {
    const reglas = basaJuevesSuper.beneficios[0].tarjetas;
    expect(tarjetaAplica("basa", reglas, mcOroTarjetaB)).toBe(false);
    expect(tarjetaAplica("basa", reglas, mcClasicaFarmacenter)).toBe(true);
    // Visa Oro sí está incluida: la exclusión es solo para Mastercard Oro.
    expect(tarjetaAplica("basa", reglas, { ...mcOroTarjetaB, marca: "visa", afinidad: null })).toBe(true);
  });

  it("el banco de la promo tiene que ser el de la tarjeta", () => {
    const reglas = basaJuevesSuper.beneficios[0].tarjetas;
    expect(tarjetaAplica("sudameris", reglas, mcClasicaFarmacenter)).toBe(false);
  });

  it("sin reglas 'incluye' aplica a todas las de crédito del banco", () => {
    expect(tarjetaAplica("basa", [], mcOroTarjetaB)).toBe(true);
    expect(tarjetaAplica("basa", [], { ...mcOroTarjetaB, tipo: "debito" })).toBe(false);
  });

  it("compara valores sin normalizar del lado de la regla", () => {
    const reglas = [
      { regla: "incluye" as const, marca: "MasterCard", nivel: "Clásica", afinidad: "Afinidad Farmacenter", tipo: null },
    ];
    expect(tarjetaAplica("Banco Basa", reglas, mcClasicaFarmacenter)).toBe(true);
  });
});

describe('BASA "Jueves de supermercado"', () => {
  it("MC Oro (Tarjeta B) queda excluida", () => {
    expect(beneficioDelDia(basaJuevesSuper, mcOroTarjetaB, JUEVES)).toBeNull();
  });

  it("MC Clásica Farmacenter: 20% con tope de Gs. 1.500.000 por mes, solo los jueves", () => {
    const beneficio = beneficioDelDia(basaJuevesSuper, mcClasicaFarmacenter, JUEVES);
    expect(beneficio?.nombre).toBe("General");
    expect(beneficio?.componentes).toEqual([
      expect.objectContaining({ tipo: "reintegro", porcentaje: 20, tope_monto: 1_500_000, tope_periodo: "mes" }),
    ]);
    expect(beneficioDelDia(basaJuevesSuper, mcClasicaFarmacenter, MIERCOLES)).toBeNull();
  });

  it("MasterCard Black usa su propia capa: 25% con tope de Gs. 2.000.000", () => {
    const mcBlack = { ...mcOroTarjetaB, nivel: "black", afinidad: null };
    const beneficio = beneficioDelDia(basaJuevesSuper, mcBlack, JUEVES);
    expect(beneficio?.nombre).toBe("Black/Signature");
    expect(beneficio?.componentes).toEqual([
      expect.objectContaining({ tipo: "reintegro", porcentaje: 25, tope_monto: 2_000_000 }),
    ]);
  });

  it("excluye prepagas y empresariales", () => {
    expect(beneficioDelDia(basaJuevesSuper, { ...mcClasicaFarmacenter, tipo: "prepaga" }, JUEVES)).toBeNull();
    expect(beneficioDelDia(basaJuevesSuper, { ...mcClasicaFarmacenter, nivel: "empresarial" }, JUEVES)).toBeNull();
  });

  it("cada comercio respeta su propia ventana", () => {
    const nombres = (fecha: string) => comerciosVigentes(basaJuevesSuper.comercios, fecha).map((c) => c.comercio_nombre);
    expect(nombres("2026-09-03")).toContain("Casa Paraná");
    expect(nombres("2026-09-03")).not.toContain("La Rosarina");
    expect(nombres("2026-10-01")).toContain("La Rosarina");
    expect(nombres("2026-10-01")).not.toContain("Casa Paraná");
    expect(nombres("2026-10-01")).toHaveLength(8);
  });

  it("fuera de vigencia no aplica", () => {
    expect(beneficioDelDia(basaJuevesSuper, mcClasicaFarmacenter, "2027-01-07")).toBeNull();
    expect(beneficioDelDia({ ...basaJuevesSuper, activa: false }, mcClasicaFarmacenter, JUEVES)).toBeNull();
  });
});

describe('BASA "Farmacenter"', () => {
  it("MC Oro (Tarjeta B) no está entre las incluidas", () => {
    expect(beneficioDelDia(basaFarmacenter, mcOroTarjetaB, MARTES)).toBeNull();
    expect(beneficioDelDia(basaFarmacenter, mcOroTarjetaB, MARTES_ESPECIAL)).toBeNull();
  });

  it("martes común: 25% / 20% en caja + 10% de reintegro + hasta 6 cuotas", () => {
    const beneficio = beneficioDelDia(basaFarmacenter, mcClasicaFarmacenter, MARTES);
    expect(beneficio?.nombre).toBe("General");
    expect(beneficio?.componentes).toEqual([
      expect.objectContaining({ tipo: "descuento_caja", porcentaje: 25 }),
      expect.objectContaining({ tipo: "descuento_caja", porcentaje: 20, alcance: "medicamentos" }),
      expect.objectContaining({ tipo: "reintegro", porcentaje: 10, tope_monto: 2_000_000, tope_periodo: "mes" }),
      expect.objectContaining({ tipo: "cuotas", cuotas: 6, es_hasta: true }),
    ]);
  });

  it("las fechas especiales reemplazan a la capa general (hasta 50% + 10% + hasta 6 cuotas)", () => {
    for (const fecha of FECHAS_ESPECIALES_FARMACENTER) {
      const beneficio = beneficioDelDia(basaFarmacenter, mcClasicaFarmacenter, fecha);
      expect(beneficio?.nombre, fecha).toBe("Especial");
      expect(beneficio?.componentes).toEqual([
        expect.objectContaining({ tipo: "descuento_caja", porcentaje: 50, es_hasta: true }),
        expect.objectContaining({ tipo: "reintegro", porcentaje: 10 }),
        expect.objectContaining({ tipo: "cuotas", cuotas: 6, es_hasta: true }),
      ]);
    }
  });

  it("otro día de la semana no aplica", () => {
    expect(beneficioDelDia(basaFarmacenter, mcClasicaFarmacenter, MIERCOLES)).toBeNull();
  });
});

describe('Sudameris "Cadena Real"', () => {
  it("solo en las fechas explícitas, con Visa o Mastercard de crédito", () => {
    const beneficio = beneficioDelDia(sudamerisCadenaReal, sudamerisVisaCredito, PRIMER_VIERNES);
    expect(beneficio?.componentes).toEqual([
      expect.objectContaining({
        tipo: "reintegro",
        porcentaje: 20,
        tope_monto: 1_500_000,
        tope_periodo: "mes",
        tope_alcance: "por cuenta",
      }),
    ]);
    expect(beneficioDelDia(sudamerisCadenaReal, sudamerisVisaCredito, SEGUNDO_VIERNES)).toBeNull();
  });

  it("no aplica a débito ni a tarjetas de otro banco", () => {
    expect(beneficioDelDia(sudamerisCadenaReal, { ...sudamerisVisaCredito, tipo: "debito" }, PRIMER_VIERNES)).toBeNull();
    expect(beneficioDelDia(sudamerisCadenaReal, mcClasicaFarmacenter, PRIMER_VIERNES)).toBeNull();
  });
});

describe("promos de un día para las tarjetas de la familia", () => {
  const tarjetas = [mcOroTarjetaB, mcClasicaFarmacenter];
  const promos = [basaJuevesSuper, basaFarmacenter, sudamerisCadenaReal];

  it("jueves: solo el súper de BASA, con la MC Clásica Farmacenter", () => {
    const matches = promosQueAplican(promos, tarjetas, JUEVES);
    expect(matches).toHaveLength(1);
    expect(matches[0].promo).toBe(basaJuevesSuper);
    expect(matches[0].tarjeta).toBe(mcClasicaFarmacenter);
  });

  it("martes especial: Farmacenter con la capa Especial; Sudameris no (no hay tarjeta)", () => {
    const matches = promosQueAplican(promos, tarjetas, MARTES_ESPECIAL);
    expect(matches.map((m) => [m.promo, m.beneficio.nombre])).toEqual([[basaFarmacenter, "Especial"]]);
  });

  it("con una Visa de crédito de Sudameris, el primer viernes aparece Cadena Real", () => {
    const matches = promosQueAplican(promos, [...tarjetas, sudamerisVisaCredito], PRIMER_VIERNES);
    expect(matches.map((m) => m.promo)).toEqual([sudamerisCadenaReal]);
  });
});

describe("tarjetasQueAplican y formato de la lista", () => {
  it("devuelve las tarjetas a las que alguna capa les sirve, sin mirar el día", () => {
    const promo = {
      banco: "basa",
      activa: true,
      vigencia_desde: null,
      vigencia_hasta: null,
      beneficios: [
        {
          nombre: "Especial",
          dias_semana: [4],
          fechas: null,
          prioridad: 1,
          componentes: [],
          tarjetas: [{ regla: "incluye" as const, marca: null, nivel: null, afinidad: "farmacenter", tipo: null }],
        },
      ],
    };
    const tarjetas = [
      { id: "a", banco: "basa", marca: "visa", nivel: "clasica", afinidad: "farmacenter", tipo: "credito" },
      { id: "b", banco: "basa", marca: "visa", nivel: "oro", afinidad: null, tipo: "credito" },
      { id: "c", banco: "itau", marca: "visa", nivel: "clasica", afinidad: "farmacenter", tipo: "credito" },
    ];
    expect(tarjetasQueAplican(promo, tarjetas).map((t) => t.id)).toEqual(["a"]);
  });

  it("describe los días de una capa", () => {
    expect(describirDias({ dias_semana: [4, 1], fechas: null })).toBe("lunes y jueves");
    expect(describirDias({ dias_semana: [0, 6, 5], fechas: [] })).toBe("viernes, sábado y domingo");
    expect(describirDias({ dias_semana: [0, 1, 2, 3, 4, 5, 6], fechas: null })).toBe("todos los días");
    expect(describirDias({ dias_semana: null, fechas: null })).toBe("todos los días");
    expect(describirDias({ dias_semana: [], fechas: ["2026-08-07", "2026-07-03"] })).toBe("03/07 y 07/08");
    expect(
      describirDias({
        dias_semana: [],
        fechas: ["2026-01-05", "2026-02-02", "2026-03-02", "2026-04-06", "2026-05-04", "2026-06-01", "2026-07-06", "2026-08-03"],
      }),
    ).toBe("05/01, 02/02, 02/03, 06/04, 04/05, 01/06 y 2 fechas más");
  });

  it("describe el origen", () => {
    expect(describirOrigen({ origen: "web", archivo_path: null })).toBe("web del banco");
    expect(describirOrigen({ origen: "api", archivo_path: null })).toBe("importación");
    expect(describirOrigen({ origen: "manual", archivo_path: "f/promos/x.pdf" })).toBe("carga manual");
    expect(describirOrigen({ origen: "manual", archivo_path: null })).toBe("mail");
  });
});
