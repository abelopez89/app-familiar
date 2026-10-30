import type { ComponenteBeneficio, PromoParaMatch, ReglaTarjeta, TarjetaParaMatch } from "@/lib/promos/matching";

/**
 * Los tres casos reales del módulo, transcriptos a mano de los PDF de esta
 * carpeta tal como tienen que quedar después de la extracción (Fase 4 del
 * módulo). Hoy alimentan los tests de matching; los de extracción van a
 * comparar la salida de Claude contra estas mismas estructuras.
 *
 * - basa-jueves-supermercado.pdf → `basaJuevesSuper`
 * - basa-farmacenter.pdf → `basaFarmacenter`
 * - sudameris-cadena-real.pdf → `sudamerisCadenaReal`
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

// Exclusiones genéricas de las bases de BASA y Sudameris: empresariales,
// Gourmet Cards y prepagas.
const exclusionesGenericas = [
  excluye({ nivel: "empresarial" }),
  excluye({ afinidad: "gourmet card" }),
  excluye({ tipo: "prepaga" }),
];

// ============ BASA "Jueves de supermercado" ============
// Incluye Visa Clásica/Oro, MasterCard Clásica y las afinidades
// Farmacenter y Club Libertad (20%), y MasterCard Black / Visa Signature
// con su propia capa (25%, tope mayor). Excluye explícitamente "Basa
// MasterCard Oro". Comercios con ventana propia: La Rosarina desde el
// 10/09, Casa Paraná excluida desde el 01/10.

const topeSuper = { tope_periodo: "mes" as const, tope_alcance: "por cuenta, en conjunto entre los supermercados" };
const exclusionesSuper = [excluye({ marca: "mastercard", nivel: "oro" }), ...exclusionesGenericas];

export const basaJuevesSuper = {
  banco: "basa",
  titulo: "Jueves de supermercado",
  activa: true,
  vigencia_desde: "2026-03-05",
  vigencia_hasta: "2026-12-31",
  canal: "POS Bancard",
  acumulable: false,
  comercios: [
    { comercio_nombre: "Box", desde: null, hasta: null },
    { comercio_nombre: "El Pueblo", desde: null, hasta: null },
    { comercio_nombre: "La Preferida", desde: null, hasta: null },
    { comercio_nombre: "La Rosarina", desde: "2026-09-10", hasta: null },
    { comercio_nombre: "Los Jardines", desde: null, hasta: null },
    { comercio_nombre: "Real", desde: null, hasta: null },
    { comercio_nombre: "Salemma", desde: null, hasta: null },
    { comercio_nombre: "Villa Sofia", desde: null, hasta: null },
    { comercio_nombre: "Casa Paraná", desde: null, hasta: "2026-09-30" },
  ],
  beneficios: [
    {
      nombre: "General",
      dias_semana: [4],
      fechas: null,
      prioridad: 0,
      componentes: [componente({ tipo: "reintegro", porcentaje: 20, tope_monto: 1_500_000, ...topeSuper })],
      tarjetas: [
        incluye({ marca: "visa", nivel: "clasica", tipo: "credito" }),
        incluye({ marca: "visa", nivel: "oro", tipo: "credito" }),
        incluye({ marca: "mastercard", nivel: "clasica", tipo: "credito" }),
        incluye({ afinidad: "farmacenter", tipo: "credito" }),
        incluye({ afinidad: "club libertad", tipo: "credito" }),
        ...exclusionesSuper,
      ],
    },
    {
      nombre: "Black/Signature",
      dias_semana: [4],
      fechas: null,
      prioridad: 1,
      componentes: [componente({ tipo: "reintegro", porcentaje: 25, tope_monto: 2_000_000, ...topeSuper })],
      tarjetas: [
        incluye({ marca: "mastercard", nivel: "black", tipo: "credito" }),
        incluye({ marca: "visa", nivel: "signature", tipo: "credito" }),
        ...exclusionesSuper,
      ],
    },
  ],
} satisfies PromoParaMatch & Record<string, unknown>;

// ============ BASA "Farmacenter" ============
// Martes: 25% en caja (productos seleccionados, no medicamentos) / 20%
// (medicamentos) + 10% de reintegro + hasta 6 cuotas. Fechas especiales:
// hasta 50% en caja + 10% de reintegro + hasta 6 cuotas, reemplazando la
// capa general. Afinidad Farmacenter, MasterCard Black y Visa Signature.

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

const tarjetasFarmacenter = [
  incluye({ afinidad: "farmacenter", tipo: "credito" }),
  incluye({ marca: "mastercard", nivel: "black", tipo: "credito" }),
  incluye({ marca: "visa", nivel: "signature", tipo: "credito" }),
  ...exclusionesGenericas,
];

const reintegroFarmacenter = componente({
  tipo: "reintegro",
  porcentaje: 10,
  tope_monto: 2_000_000,
  tope_periodo: "mes",
});

export const basaFarmacenter = {
  banco: "basa",
  titulo: "Farmacenter",
  activa: true,
  vigencia_desde: null,
  vigencia_hasta: "2026-12-31",
  canal: "POS Bancard",
  acumulable: false,
  comercios: [{ comercio_nombre: "Farmacenter", desde: null, hasta: null }],
  beneficios: [
    {
      nombre: "General",
      dias_semana: [2],
      fechas: null,
      prioridad: 0,
      componentes: [
        componente({ tipo: "descuento_caja", porcentaje: 25, alcance: "productos seleccionados, excepto medicamentos" }),
        componente({ tipo: "descuento_caja", porcentaje: 20, alcance: "medicamentos" }),
        reintegroFarmacenter,
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
        componente({ tipo: "descuento_caja", porcentaje: 50, es_hasta: true, alcance: "productos seleccionados" }),
        reintegroFarmacenter,
        componente({ tipo: "cuotas", cuotas: 6, es_hasta: true }),
      ],
      tarjetas: tarjetasFarmacenter,
    },
  ],
} satisfies PromoParaMatch & Record<string, unknown>;

// ============ Sudameris "Cadena Real" ============
// Solo el 20% de reintegro del primer viernes de cada mes. El beneficio de
// "hasta 12 cuotas en electrodomésticos/jardín/decoración" se descarta por
// ser solo cuotas.

export const sudamerisCadenaReal = {
  banco: "sudameris",
  titulo: "Cadena Real",
  activa: true,
  vigencia_desde: "2026-07-01",
  vigencia_hasta: "2026-12-31",
  canal: "POS Bancard",
  version_doc: "V1 – 30/09/2026",
  comercios: [{ comercio_nombre: "Real", desde: null, hasta: null }],
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
      tarjetas: [
        incluye({ marca: "visa", tipo: "credito" }),
        incluye({ marca: "mastercard", tipo: "credito" }),
        ...exclusionesGenericas,
      ],
    },
  ],
} satisfies PromoParaMatch & Record<string, unknown>;
