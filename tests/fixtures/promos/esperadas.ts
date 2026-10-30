import type { ComponenteBeneficio, PromoParaMatch, ReglaTarjeta, TarjetaParaMatch } from "@/lib/promos/matching";

/**
 * Los tres casos reales del módulo, ya estructurados como tienen que quedar
 * después de la extracción (Fase 4 del módulo). Hoy alimentan los tests de
 * matching; cuando estén los PDF en esta carpeta, los tests de extracción
 * van a comparar la salida de Claude contra estas mismas estructuras.
 */

const componente = (c: Partial<ComponenteBeneficio> & Pick<ComponenteBeneficio, "tipo">): ComponenteBeneficio => ({
  porcentaje: null,
  monto: null,
  cuotas: null,
  es_hasta: false,
  alcance: null,
  tope_monto: null,
  tope_periodo: null,
  tope_alcance: null,
  ...c,
});

const incluye = (r: Partial<Omit<ReglaTarjeta, "regla">>): ReglaTarjeta => ({
  regla: "incluye",
  marca: null,
  nivel: null,
  afinidad: null,
  tipo: null,
  ...r,
});

const excluye = (r: Partial<Omit<ReglaTarjeta, "regla">>): ReglaTarjeta => ({ ...incluye(r), regla: "excluye" });

// ============ Tarjetas de BASA de la familia ============

export const mcOroTarjetaB: TarjetaParaMatch = {
  banco: "basa",
  marca: "mastercard",
  nivel: "oro",
  afinidad: "tarjeta b",
  tipo: "credito",
};

export const mcClasicaFarmacenter: TarjetaParaMatch = {
  banco: "basa",
  marca: "mastercard",
  nivel: "clasica",
  afinidad: "farmacenter",
  tipo: "credito",
};

// ============ BASA "Jueves de supermercado" ============
// Incluye Visa (Oro incluida) y Mastercard, pero excluye explícitamente
// "Basa MasterCard Oro". Comercios con ventana propia.

export const basaJuevesSuper = {
  banco: "basa",
  activa: true,
  vigencia_desde: "2026-09-01",
  vigencia_hasta: "2026-12-31",
  comercios: [
    { comercio_nombre: "Real", desde: null, hasta: null },
    { comercio_nombre: "La Rosarina", desde: "2026-09-10", hasta: null },
    { comercio_nombre: "Casa Paraná", desde: null, hasta: "2026-09-30" },
  ],
  beneficios: [
    {
      nombre: "General",
      dias_semana: [4],
      fechas: null,
      prioridad: 0,
      componentes: [
        componente({
          tipo: "reintegro",
          porcentaje: 20,
          tope_monto: 1_500_000,
          tope_periodo: "mes",
        }),
      ],
      tarjetas: [
        incluye({ marca: "visa" }),
        incluye({ marca: "mastercard" }),
        excluye({ marca: "mastercard", nivel: "oro" }),
      ],
    },
  ],
} satisfies PromoParaMatch & { comercios: unknown[] };

// ============ BASA "Farmacenter" ============
// Martes: 25% en caja (no medicamentos) / 20% (medicamentos) + 10% de
// reintegro + hasta 6 cuotas. Fechas especiales: hasta 50% en caja + 10%
// de reintegro, reemplazando la capa general.

export const FECHAS_ESPECIALES_FARMACENTER = [
  "2026-04-14",
  "2026-05-12",
  "2026-06-16",
  "2026-07-28",
  "2026-08-11",
  "2026-09-22",
  "2026-10-27",
  "2026-11-10",
  "2026-12-08",
  "2026-12-22",
];

const tarjetasFarmacenter = [incluye({ marca: "mastercard", afinidad: "farmacenter" })];

export const basaFarmacenter = {
  banco: "basa",
  activa: true,
  vigencia_desde: "2026-04-01",
  vigencia_hasta: "2026-12-31",
  beneficios: [
    {
      nombre: "General",
      dias_semana: [2],
      fechas: null,
      prioridad: 0,
      componentes: [
        componente({ tipo: "descuento_caja", porcentaje: 25, alcance: "excepto medicamentos" }),
        componente({ tipo: "descuento_caja", porcentaje: 20, alcance: "medicamentos" }),
        componente({ tipo: "reintegro", porcentaje: 10 }),
        componente({ tipo: "cuotas", cuotas: 6, es_hasta: true }),
      ],
      tarjetas: tarjetasFarmacenter,
    },
    {
      nombre: "Especial",
      dias_semana: null,
      fechas: FECHAS_ESPECIALES_FARMACENTER,
      prioridad: 1,
      componentes: [
        componente({ tipo: "descuento_caja", porcentaje: 50, es_hasta: true }),
        componente({ tipo: "reintegro", porcentaje: 10 }),
      ],
      tarjetas: tarjetasFarmacenter,
    },
  ],
} satisfies PromoParaMatch;

// ============ Sudameris "Cadena Real" ============
// Solo el 20% de reintegro (el de "12 cuotas en electro/jardín/deco" se
// descarta por ser solo cuotas).

export const sudamerisCadenaReal = {
  banco: "sudameris",
  activa: true,
  vigencia_desde: "2026-07-01",
  vigencia_hasta: "2026-12-31",
  beneficios: [
    {
      nombre: "General",
      dias_semana: null,
      fechas: ["2026-07-03", "2026-08-07", "2026-09-04", "2026-10-02", "2026-11-06", "2026-12-04"],
      prioridad: 0,
      componentes: [
        componente({
          tipo: "reintegro",
          porcentaje: 20,
          tope_monto: 1_500_000,
          tope_periodo: "mes",
          tope_alcance: "por cuenta",
        }),
      ],
      tarjetas: [incluye({ marca: "visa", tipo: "credito" }), incluye({ marca: "mastercard", tipo: "credito" })],
    },
  ],
} satisfies PromoParaMatch;
