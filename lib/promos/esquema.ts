import { z } from "zod";

/**
 * Forma interna de una promo normalizada, 1:1 con las tablas de la
 * migración 014 (promociones → comercios / beneficios → componentes /
 * tarjetas), con `null` donde el texto no dice nada. Es lo que reciben
 * `filtrado.ts` y la persistencia.
 *
 * Lo que ve el modelo es otro esquema, `salidaModeloSchema` (más abajo),
 * sin campos opcionales: structured outputs admite como mucho 16
 * parámetros con unión de tipos (cada `.nullable()` cuenta uno), y esta
 * forma tiene 19. `deSalidaModelo` convierte de uno al otro.
 */

const fecha = z.string().describe("Fecha yyyy-MM-dd");

export const componenteSchema = z.object({
  tipo: z.enum(["descuento_caja", "reintegro", "descuento_monto", "cuotas"]),
  porcentaje: z.number().nullable().describe("Porcentaje de descuento o reintegro, ej. 20"),
  monto: z.number().nullable().describe("Monto fijo en guaraníes, solo para descuento_monto"),
  cuotas: z.number().int().nullable().describe("Cantidad de cuotas sin intereses, solo para tipo cuotas"),
  es_hasta: z.boolean().describe('true si el banco dice "hasta" (hasta 50%, hasta 6 cuotas)'),
  alcance: z.string().nullable().describe("Sobre qué productos aplica, ej. 'medicamentos'"),
  tope_monto: z.number().nullable().describe("Tope de compra o de reintegro en guaraníes"),
  tope_periodo: z.enum(["dia", "mes", "promo"]).nullable(),
  tope_alcance: z.string().nullable().describe("Ej. 'por cuenta, compartido entre comercios'"),
  // Migración 015. Opcional: las promos y fixtures anteriores no lo tienen.
  tope_tipo: z
    .enum(["compra", "descuento"])
    .nullable()
    .optional()
    .describe("Si el tope limita el monto de compra o el del descuento/reintegro"),
});

export const reglaTarjetaSchema = z.object({
  regla: z.enum(["incluye", "excluye"]),
  marca: z.string().nullable().describe("visa | mastercard | amex | otra; null = cualquiera"),
  nivel: z.string().nullable().describe("clasica | oro | platinum | black | signature | infinite | empresarial…; null = cualquiera"),
  afinidad: z.string().nullable().describe("Nombre de la afinidad sin la palabra 'afinidad', ej. 'farmacenter'; null = cualquiera"),
  tipo: z.enum(["credito", "debito", "prepaga"]).nullable(),
});

export const beneficioSchema = z.object({
  nombre: z.string().describe("General, Especial, Black/Signature…"),
  dias_semana: z.array(z.number().int()).nullable().describe("0=domingo … 6=sábado; null si vale todos los días o solo fechas"),
  fechas: z.array(fecha).nullable().describe("Fechas explícitas cuando el banco las lista"),
  prioridad: z.number().int().describe("Mayor gana cuando dos capas valen el mismo día"),
  componentes: z.array(componenteSchema),
  tarjetas: z.array(reglaTarjetaSchema),
});

export const promoNormalizadaSchema = z.object({
  titulo: z.string(),
  resumen: z.string().describe("Una línea en castellano, ej. '20% de reintegro los jueves en supermercados'"),
  rubro: z.enum(["supermercado", "farmacia", "combustible", "electrodomesticos", "otro"]),
  canal: z.string().nullable().describe("Ej. 'POS Bancard', 'web'"),
  version_doc: z.string().nullable().describe("Versión o fecha del documento, ej. 'V1 – 30/09/2026'"),
  acumulable: z.boolean().nullable(),
  vigencia_desde: fecha.nullable(),
  vigencia_hasta: fecha.nullable(),
  comercios: z.array(
    z.object({
      nombre: z.string(),
      desde: fecha.nullable(),
      hasta: fecha.nullable().describe("Si el comercio queda excluido desde una fecha, el día anterior"),
    }),
  ),
  beneficios: z.array(beneficioSchema),
});

export const normalizacionSchema = z.object({
  promociones: z.array(promoNormalizadaSchema),
});

export type ComponenteNormalizado = z.infer<typeof componenteSchema>;
export type ReglaNormalizada = z.infer<typeof reglaTarjetaSchema>;
export type BeneficioNormalizado = z.infer<typeof beneficioSchema>;
export type PromoNormalizada = z.infer<typeof promoNormalizadaSchema>;
export type Normalizacion = z.infer<typeof normalizacionSchema>;

// ============ Lo que ve el modelo ============
// Sin uniones: "no dice" se expresa con "", 0, [] o un valor de enum
// explícito, y `deSalidaModelo` lo vuelve `null`. Agregar un `.nullable()`
// acá rompe la llamada si el total pasa de 16 (lo vigila un test).

const SIN_DATO = 'Vacío ("") si el texto no lo dice.';

const componenteModelo = z.object({
  tipo: z.enum(["descuento_caja", "reintegro", "descuento_monto", "cuotas"]),
  porcentaje: z.number().describe("Porcentaje de descuento o reintegro, ej. 20. 0 si no aplica."),
  monto: z.number().describe("Monto fijo en guaraníes, solo para descuento_monto. 0 si no aplica."),
  cuotas: z.number().int().describe("Cantidad de cuotas sin intereses, solo para tipo cuotas. 0 si no aplica."),
  es_hasta: z.boolean().describe('true si el banco dice "hasta" (hasta 50%, hasta 6 cuotas)'),
  alcance: z.string().describe(`Sobre qué productos aplica, ej. "medicamentos". ${SIN_DATO}`),
  tope_monto: z.number().describe("Tope de compra o de reintegro en guaraníes. 0 si no hay tope."),
  tope_periodo: z.enum(["dia", "mes", "promo", "sin_tope"]),
  tope_tipo: z
    .enum(["compra", "descuento", "no_dice"])
    .describe('"compra" si limita el monto de compra ("compras hasta…"), "descuento" si limita el descuento o reintegro ("reintegro hasta…"). "no_dice" si no hay tope o no queda claro.'),
  tope_alcance: z.string().describe(`Ej. "por cuenta, compartido entre comercios". ${SIN_DATO}`),
});

const reglaModelo = z.object({
  regla: z.enum(["incluye", "excluye"]),
  marca: z.string().describe(`visa | mastercard | amex | otra. "" = cualquiera.`),
  nivel: z.string().describe(`clasica | oro | platinum | black | signature | infinite | empresarial… "" = cualquiera.`),
  afinidad: z.string().describe(`Nombre de la afinidad sin la palabra "afinidad", ej. "farmacenter". "" = cualquiera.`),
  tipo: z.enum(["credito", "debito", "prepaga", "cualquiera"]),
});

const beneficioModelo = z.object({
  nombre: z.string().describe("General, Especial, Black/Signature…"),
  dias_semana: z.array(z.number().int()).describe("0=domingo … 6=sábado; [] si vale todos los días o solo fechas"),
  fechas: z.array(fecha).describe("Fechas explícitas cuando el banco las lista; [] si no"),
  prioridad: z.number().int().describe("Mayor gana cuando dos capas valen el mismo día"),
  componentes: z.array(componenteModelo),
  tarjetas: z.array(reglaModelo),
});

const promoModelo = z.object({
  titulo: z.string(),
  resumen: z.string().describe("Una línea en castellano, ej. '20% de reintegro los jueves en supermercados'"),
  rubro: z.enum(["supermercado", "farmacia", "combustible", "electrodomesticos", "otro"]),
  canal: z.string().describe(`Ej. "POS Bancard", "web". ${SIN_DATO}`),
  version_doc: z.string().describe(`Versión o fecha del documento si la tiene, ej. "V1 – 30/09/2026". ${SIN_DATO}`),
  acumulable: z.enum(["si", "no", "no_dice"]),
  vigencia_desde: z.string().describe(`Fecha yyyy-MM-dd. ${SIN_DATO}`),
  vigencia_hasta: z.string().describe(`Fecha yyyy-MM-dd. ${SIN_DATO}`),
  comercios: z.array(
    z.object({
      nombre: z.string(),
      desde: z.string().describe(`Fecha yyyy-MM-dd. ${SIN_DATO}`),
      hasta: z.string().describe(`Fecha yyyy-MM-dd; si queda excluido desde una fecha, el día anterior. ${SIN_DATO}`),
    }),
  ),
  beneficios: z.array(beneficioModelo),
});

export const salidaModeloSchema = z.object({
  promociones: z.array(promoModelo),
});

export type SalidaModelo = z.infer<typeof salidaModeloSchema>;

const texto = (v: string) => (v.trim() === "" ? null : v);
const numero = (v: number) => (v > 0 ? v : null);

/** Salida del modelo (sin nulls) → forma interna (con nulls). */
export function deSalidaModelo(salida: SalidaModelo): PromoNormalizada[] {
  return salida.promociones.map((p) => ({
    titulo: p.titulo,
    resumen: p.resumen,
    rubro: p.rubro,
    canal: texto(p.canal),
    version_doc: texto(p.version_doc),
    acumulable: p.acumulable === "no_dice" ? null : p.acumulable === "si",
    vigencia_desde: texto(p.vigencia_desde),
    vigencia_hasta: texto(p.vigencia_hasta),
    comercios: p.comercios.map((c) => ({ nombre: c.nombre, desde: texto(c.desde), hasta: texto(c.hasta) })),
    beneficios: p.beneficios.map((b) => ({
      nombre: b.nombre,
      dias_semana: b.dias_semana.length > 0 ? b.dias_semana : null,
      fechas: b.fechas.length > 0 ? b.fechas : null,
      prioridad: b.prioridad,
      componentes: b.componentes.map((c) => ({
        tipo: c.tipo,
        porcentaje: numero(c.porcentaje),
        monto: numero(c.monto),
        cuotas: numero(c.cuotas),
        es_hasta: c.es_hasta,
        alcance: texto(c.alcance),
        tope_monto: numero(c.tope_monto),
        tope_periodo: c.tope_periodo === "sin_tope" ? null : c.tope_periodo,
        tope_alcance: texto(c.tope_alcance),
        tope_tipo: c.tope_tipo === "no_dice" || !numero(c.tope_monto) ? null : c.tope_tipo,
      })),
      tarjetas: b.tarjetas.map((t) => ({
        regla: t.regla,
        marca: texto(t.marca),
        nivel: texto(t.nivel),
        afinidad: texto(t.afinidad),
        tipo: t.tipo === "cualquiera" ? null : t.tipo,
      })),
    })),
  }));
}
