import { formatGuaranies } from "@/lib/format";
import type { ComponenteBeneficio } from "./matching";

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
