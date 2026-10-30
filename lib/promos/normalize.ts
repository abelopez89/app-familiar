import { BANCOS, MARCAS, NIVELES, type Banco, type Marca, type TipoTarjeta } from "./constants";

/**
 * Normalización de marca, nivel, afinidad, tipo y banco: minúsculas, sin
 * tildes, espacios colapsados y sinónimos resueltos. Se aplica a las
 * tarjetas de la familia al guardarlas y a las reglas de las promos al
 * ingerirlas, y el matching la vuelve a aplicar al comparar (barato, y no
 * depende de que la fila se haya guardado bien).
 */
export function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const SINONIMOS_MARCA: Record<string, Marca> = {
  visa: "visa",
  mastercard: "mastercard",
  "master card": "mastercard",
  master: "mastercard",
  mc: "mastercard",
  amex: "amex",
  "american express": "amex",
};

const SINONIMOS_NIVEL: Record<string, string> = {
  clasica: "clasica",
  clasic: "clasica",
  classic: "clasica",
  oro: "oro",
  gold: "oro",
  platinum: "platinum",
  platinium: "platinum",
  platino: "platinum",
  black: "black",
  signature: "signature",
  infinite: "infinite",
};

const SINONIMOS_TIPO: Record<string, TipoTarjeta> = {
  credito: "credito",
  credit: "credito",
  debito: "debito",
  debit: "debito",
  prepaga: "prepaga",
  prepago: "prepaga",
  prepaid: "prepaga",
};

const SINONIMOS_BANCO: Record<string, Banco> = {
  gnb: "gnb",
  "banco gnb": "gnb",
  itau: "itau",
  "banco itau": "itau",
  sudameris: "sudameris",
  "sudameris bank": "sudameris",
  basa: "basa",
  "banco basa": "basa",
};

function vacioANull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = normalizarTexto(value);
  return normalized === "" ? null : normalized;
}

/** Marca conocida → su clave; desconocida → el texto normalizado (no se descarta). */
export function normalizarMarca(value: string | null | undefined): string | null {
  const v = vacioANull(value);
  if (v === null) return null;
  return SINONIMOS_MARCA[v] ?? v;
}

export function normalizarNivel(value: string | null | undefined): string | null {
  const v = vacioANull(value);
  if (v === null) return null;
  return SINONIMOS_NIVEL[v] ?? v;
}

/** "Afinidad Farmacenter" → "farmacenter"; "Tarjeta B" → "tarjeta b". */
export function normalizarAfinidad(value: string | null | undefined): string | null {
  const v = vacioANull(value);
  if (v === null) return null;
  return vacioANull(v.replace(/^(tarjeta de )?afinidad /, ""));
}

export function normalizarTipo(value: string | null | undefined): string | null {
  const v = vacioANull(value);
  if (v === null) return null;
  return SINONIMOS_TIPO[v] ?? v;
}

export function normalizarBanco(value: string | null | undefined): string | null {
  const v = vacioANull(value);
  if (v === null) return null;
  return SINONIMOS_BANCO[v] ?? v;
}

export function esBanco(value: string): value is Banco {
  return value in BANCOS;
}

export function esMarca(value: string): value is Marca {
  return value in MARCAS;
}

/**
 * "farmacenter" → "Farmacenter", "tarjeta b" → "Tarjeta B". Pensada para
 * valores ya normalizados (solo a-z, dígitos y espacios).
 */
export function capitalizarPalabras(value: string): string {
  return value.replace(/(^|\s)([a-z])/g, (_, sep: string, letra: string) => sep + letra.toUpperCase());
}

export function etiquetaNivel(nivel: string): string {
  return nivel in NIVELES ? NIVELES[nivel as keyof typeof NIVELES].label : capitalizarPalabras(nivel);
}

/**
 * Nombre corto de una tarjeta, el de los avisos: "MC Clásica Farmacenter".
 */
export function nombreTarjeta(tarjeta: {
  marca: string;
  nivel: string;
  afinidad: string | null;
}): string {
  const marca = esMarca(tarjeta.marca) ? MARCAS[tarjeta.marca].corta : capitalizarPalabras(tarjeta.marca);
  return [marca, etiquetaNivel(tarjeta.nivel), tarjeta.afinidad ? capitalizarPalabras(tarjeta.afinidad) : null]
    .filter(Boolean)
    .join(" ");
}
