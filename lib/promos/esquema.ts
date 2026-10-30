import { z } from "zod";

/**
 * Salida estructurada de la normalización con Claude. Mapea 1:1 con las
 * tablas de la migración 014 (promociones → comercios / beneficios →
 * componentes / tarjetas). Va en `output_config.format`, así que la API
 * garantiza que la respuesta cumple el esquema; aun así `filtrado.ts`
 * vuelve a validar fechas, días y valores normalizados antes de guardar.
 *
 * Sin restricciones numéricas ni de largo (la API no las admite en
 * structured outputs): los rangos se controlan en `filtrado.ts`.
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
