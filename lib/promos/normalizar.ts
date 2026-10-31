import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getAnthropicApiKey } from "@/lib/env";
import { BANCOS, type Banco } from "./constants";
import { deSalidaModelo, salidaModeloSchema, type PromoNormalizada } from "./esquema";

/**
 * Normalización de una promo con Claude: texto/HTML del banco → estructura
 * de la migración 014, con salida JSON estricta (`output_config.format`).
 *
 * - Modelo Sonnet, como pidió el usuario. Effort `medium`: es extracción
 *   con reglas, no razonamiento abierto; si la calidad no alcanza, subir.
 * - `fallbacks: "default"`: si el clasificador de seguridad rechaza un
 *   texto (no debería, son bases y condiciones de un banco), la API lo
 *   reintenta en otro modelo en la misma llamada en vez de devolver una
 *   negativa.
 * - El prompt de sistema es fijo (sin fechas ni nada variable) y lleva
 *   `cache_control`: se paga entero una vez y las demás promos de la misma
 *   corrida lo leen de caché. La fecha de hoy va en el mensaje del usuario.
 */

const MODELO = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `Sos el normalizador de promociones bancarias de una app familiar de Paraguay. Recibís el texto de una promoción de tarjetas (de una API, una página web o un PDF de bases y condiciones) y devolvés su estructura exacta según el esquema JSON. Todo en castellano.

Qué se guarda (las reglas las aplica después el código, pero tu salida tiene que permitirlo):
- Solo interesan los beneficios con descuento: porcentaje de descuento en caja, porcentaje de reintegro o descuento en monto fijo ("hasta Gs. 2.000.000 de descuento"). Las cuotas sin intereses se registran como componente extra de una capa que ya tiene descuento.
- Un beneficio que es SOLO cuotas sin intereses, un sorteo, un cupón, puntos o millas no lleva componentes de descuento: devolvelo con los componentes que tenga (o sin componentes); el código lo descarta.
- Rubro, lista cerrada: "supermercado", "farmacia", "combustible" (estaciones de servicio), "electrodomesticos" (electrodomésticos, tecnología, celulares, línea blanca). Cualquier otra cosa (gastronomía, ropa, viajes, belleza, hogar en general, salud que no sea farmacia) es "otro". Decidilo por el comercio y el texto, no por la categoría que use el banco.

Estructura:
- Una promoción tiene comercios, vigencia y una o más capas (beneficios). Cada capa tiene días, componentes y reglas de tarjetas.
- Capas: cuando el documento distingue niveles (beneficios generales vs. especiales, o un porcentaje mayor para Black/Signature), cada nivel es una capa. Si dos capas pueden valer el mismo día para la misma tarjeta, la que reemplaza a la otra lleva prioridad mayor (General = 0, Especial = 1).
- Días: dias_semana como enteros, 0 = domingo, 1 = lunes … 6 = sábado. Cuando el documento lista fechas explícitas ("03 de julio, 07 de agosto…", "primer viernes de cada mes" con las fechas escritas), usá fechas y dejá dias_semana vacío: preferí siempre las fechas explícitas. Si vale todos los días de la vigencia, ambos vacíos.
- Fechas en formato yyyy-MM-dd. Si el documento no dice el año, usá el de la vigencia o el año en curso que viene en el mensaje.
- Componentes: los beneficios de una capa se SUMAN (descuento en caja + reintegro + cuotas). Un porcentaje distinto según el producto (25% salvo medicamentos, 20% en medicamentos) son dos componentes con su alcance. "Hasta X%" lleva es_hasta = true. El tope ("tope de compra Gs. 1.500.000 por mes por cuenta") va en el componente al que aplica, con tope_periodo y tope_alcance.
- Tarjetas: reglas "incluye" por cada tarjeta nombrada como participante y "excluye" por cada exclusión. Campos en minúscula y sin tildes: marca (visa, mastercard, amex), nivel (clasica, oro, platinum, black, signature, infinite, empresarial), afinidad (el nombre de la tarjeta de afinidad sin la palabra "afinidad", ej. "farmacenter", "club libertad"; "Gourmet Card" es afinidad "gourmet card"), tipo (credito, debito, prepaga). Un campo que no se especifica va vacío ("", o tipo "cualquiera"): es un comodín. Ej.: "Visa Oro" → marca visa, nivel oro; "Afinidad Farmacenter" → solo afinidad farmacenter; "tarjetas de crédito Visa y Mastercard" → dos reglas con tipo credito; "se excluyen las prepagas y las empresariales" → excluye tipo prepaga, excluye nivel empresarial. Si el documento no nombra tarjetas, no pongas reglas.
- Comercios: cada comercio adherido con su ventana. "Desde el 10/09" → desde. "Se excluye X desde el 01/10" → X con hasta = el día anterior (30/09).
- Canal: por dónde se procesa ("POS Bancard", "web"), si lo dice. acumulable: "no" si dice "no acumulable", "no_dice" si no lo dice.
- Origen automático (API o web): devolvé una sola promoción. Documento manual: una promoción por cada beneficio distinto del documento (pueden ser varias).
- No inventes datos: lo que el texto no dice va vacío ("" en textos, 0 en números, [] en listas, "cualquiera"/"sin_tope"/"no_dice" en esas opciones).`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: getAnthropicApiKey(), maxRetries: 2, timeout: 120_000 });
  return client;
}

export type FuenteNormalizacion = "api" | "web" | "manual";

export class NormalizacionError extends Error {}

export async function normalizarPromo(input: {
  banco: Banco;
  origen: FuenteNormalizacion;
  texto: string;
  hoy: string;
}): Promise<PromoNormalizada[]> {
  const response = await getClient().beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(salidaModeloSchema) },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          `Banco: ${BANCOS[input.banco].label}`,
          `Origen: ${input.origen === "manual" ? "documento manual" : `automático (${input.origen})`}`,
          `Hoy: ${input.hoy}`,
          "",
          "<promo>",
          input.texto,
          "</promo>",
        ].join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new NormalizacionError("el modelo rechazó el texto");
  if (response.stop_reason === "max_tokens") throw new NormalizacionError("la respuesta quedó cortada");
  if (!response.parsed_output) throw new NormalizacionError("la respuesta no cumple el esquema");
  return deSalidaModelo(response.parsed_output);
}
