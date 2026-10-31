import { formatGuaranies } from "@/lib/format";
import type { BeneficioParaMatch, ComponenteBeneficio } from "./matching";

/**
 * Textos de un beneficio para la pantalla y los avisos: "25% en caja
 * (excepto medicamentos)", "10% reintegro", "hasta 6 cuotas", "tope
 * Gs. 1.500.000/mes". Puro, para que la app y Telegram digan lo mismo.
 */

const PERIODO: Record<NonNullable<ComponenteBeneficio["tope_periodo"]>, string> = {
  dia: "/día",
  mes: "/mes",
  promo: " en toda la promo",
};

function porcentaje(value: number): string {
  return `${Number.isInteger(value) ? value : value.toLocaleString("es-PY")}%`;
}

export function describirComponente(c: ComponenteBeneficio): string {
  const hasta = c.es_hasta ? "hasta " : "";
  const alcance = c.alcance ? ` (${c.alcance})` : "";
  switch (c.tipo) {
    case "descuento_caja":
      return `${hasta}${porcentaje(c.porcentaje ?? 0)} en caja${alcance}`;
    case "reintegro":
      return `${hasta}${porcentaje(c.porcentaje ?? 0)} reintegro${alcance}`;
    case "descuento_monto":
      return `${hasta}${formatGuaranies(c.monto ?? 0)} de descuento${alcance}`;
    case "cuotas":
      return `${hasta}${c.cuotas} cuotas sin intereses${alcance}`;
  }
}

/**
 * Los topes distintos de una capa, sin repetir: Farmacenter tiene el tope
 * solo en el reintegro; si dos componentes comparten tope se muestra una
 * vez.
 */
export function describirTopes(componentes: ComponenteBeneficio[]): string[] {
  const vistos = new Set<string>();
  for (const c of componentes) {
    if (!c.tope_monto) continue;
    const texto = `tope ${formatGuaranies(c.tope_monto)}${c.tope_periodo ? PERIODO[c.tope_periodo] : ""}`;
    vistos.add(c.tope_alcance ? `${texto} (${c.tope_alcance})` : texto);
  }
  return [...vistos];
}

/** Días entre dos fechas "yyyy-MM-dd" (b − a). */
export function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export const DIAS_VENCE_PRONTO = 7;

/** Vence en 7 días o menos (incluye hoy). */
export function vencePronto(vigenciaHasta: string | null, hoy: string): boolean {
  if (!vigenciaHasta) return false;
  const dias = diasEntre(hoy, vigenciaHasta);
  return dias >= 0 && dias <= DIAS_VENCE_PRONTO;
}

const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MAX_FECHAS = 6;

/** "2026-12-31" → "miércoles". */
export function nombreDia(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return NOMBRES_DIA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-12-31" → "31/12". */
export function diaMes(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

/**
 * Cuándo vale una capa: "lunes y jueves", "03/07, 07/08 y 04/09" (las
 * primeras seis fechas y cuántas más) o "todos los días".
 */
export function describirDias(beneficio: Pick<BeneficioParaMatch, "dias_semana" | "fechas">): string {
  const lista = (items: string[]) =>
    items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
  const fechas = [...(beneficio.fechas ?? [])].sort();
  const dias = [...new Set(beneficio.dias_semana ?? [])].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const partes: string[] = [];
  if (dias.length === 7) return "todos los días";
  // Lunes primero, domingo al final.
  if (dias.length > 0) partes.push(lista([...dias.filter((d) => d !== 0), ...dias.filter((d) => d === 0)].map((d) => NOMBRES_DIA[d])));
  if (fechas.length > 0) {
    const visibles = fechas.slice(0, MAX_FECHAS).map(diaMes);
    const resto = fechas.length - visibles.length;
    partes.push(resto > 0 ? `${visibles.join(", ")} y ${resto} fecha${resto === 1 ? "" : "s"} más` : lista(visibles));
  }
  return partes.length > 0 ? partes.join("; ") : "todos los días";
}

export type OrigenPromo = { origen: "api" | "web" | "manual"; archivo_path: string | null };

/**
 * De dónde salió una promo: la ingesta de Itaú (`web`), el JSON de GNB
 * (`api`), la carga manual de un PDF o captura (tiene archivo) o un mail
 * (manual sin archivo).
 */
export function describirOrigen(promo: OrigenPromo): string {
  if (promo.origen === "web") return "web del banco";
  if (promo.origen === "api") return "importación";
  return promo.archivo_path ? "carga manual" : "mail";
}
