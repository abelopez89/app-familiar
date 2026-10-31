/**
 * Catálogos cerrados del módulo de promociones. Los valores son los que se
 * guardan en la base (ver los `check` de la migración 014); las etiquetas
 * son solo de presentación.
 */

export const BANCOS = {
  gnb: { label: "GNB" },
  itau: { label: "Itaú" },
  sudameris: { label: "Sudameris" },
  basa: { label: "BASA" },
} as const;
export type Banco = keyof typeof BANCOS;

export const MARCAS = {
  visa: { label: "Visa", corta: "Visa" },
  mastercard: { label: "Mastercard", corta: "MC" },
  amex: { label: "American Express", corta: "Amex" },
} as const;
export type Marca = keyof typeof MARCAS;

/**
 * Niveles que se ofrecen en el formulario. La columna es texto libre (los
 * bancos inventan niveles nuevos), pero lo que entra pasa por
 * `normalizarNivel`, así que estos son los valores esperables.
 */
export const NIVELES = {
  clasica: { label: "Clásica" },
  oro: { label: "Oro" },
  platinum: { label: "Platinum" },
  black: { label: "Black" },
  signature: { label: "Signature" },
  infinite: { label: "Infinite" },
} as const;
export type NivelConocido = keyof typeof NIVELES;

export const TIPOS_TARJETA = {
  credito: { label: "Crédito" },
  debito: { label: "Débito" },
  prepaga: { label: "Prepaga" },
} as const;
export type TipoTarjeta = keyof typeof TIPOS_TARJETA;

/** Los únicos rubros que se guardan; todo lo demás se descarta al ingerir. */
export const RUBROS = {
  supermercado: { label: "Supermercado", emoji: "🛒" },
  farmacia: { label: "Farmacia", emoji: "💊" },
  combustible: { label: "Combustible", emoji: "⛽" },
  electrodomesticos: { label: "Electrodomésticos", emoji: "🔌" },
} as const;
export type Rubro = keyof typeof RUBROS;

/**
 * Una ingesta sin terminar que empezó hace menos que esto se considera en
 * curso (la función de Vercel dura como mucho 300 s; con margen). Más
 * vieja, se murió a mitad de camino y no bloquea una corrida nueva.
 */
export const INGESTA_EN_CURSO_MS = 6 * 60_000;

/**
 * Avisos de promos por Telegram (Fase 5), prendidos o apagados en el
 * código, igual que `FEATURES`: se tocan pocas veces y no justifican una
 * pantalla ni una columna. El semanal arranca apagado (es opcional).
 */
export const PROMOS_AVISOS = {
  /** Resumen de las promos de hoy, desde las 07:00. */
  diario: true,
  /** Promos con fecha puntual que valen mañana, desde las 20:00. */
  vispera: true,
  /** Promos cargadas a mano (PDF o mail) que vencen en 7 días o menos. */
  vencimiento: true,
  /** Los lunes, las promos de los próximos 7 días. */
  semanal: false,
} as const;

export const HORA_AVISO_DIARIO = 7;
export const HORA_AVISO_VISPERA = 20;
