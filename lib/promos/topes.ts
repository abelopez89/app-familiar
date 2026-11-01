import { acumulado, type Aplicado, type DetalleUso, type UsoAnterior } from "./ahorro";

/**
 * Cuánto se usó de cada tope por promo y tarjeta (pantalla "Ahorros del
 * mes"). Puro: recibe los usos (con su `detalle`) y una fecha de
 * referencia dentro del mes que se mira. El tope de cada componente sale
 * del uso más nuevo (la copia guardada al registrar).
 */

export type UsoParaTope = UsoAnterior & {
  promo_id: string | null;
  tarjeta_id: string | null;
  promo_titulo: string;
  tarjeta_alias: string;
};

export type EstadoTope = {
  clave: string;
  promoTitulo: string;
  tarjetaAlias: string;
  tipo: Aplicado["tipo"];
  tope: number;
  topeTipo: Aplicado["tope_tipo"];
  periodo: Aplicado["tope_periodo"];
  usado: number;
};

export function estadoTopes(usos: UsoParaTope[], fecha: string): EstadoTope[] {
  const grupos = new Map<string, UsoParaTope[]>();
  for (const u of usos) {
    if (!u.promo_id || !u.tarjeta_id) continue;
    const k = `${u.promo_id}:${u.tarjeta_id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), u]);
  }

  const estados: EstadoTope[] = [];
  for (const grupo of grupos.values()) {
    const ordenados = [...grupo].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const vistos = new Set<string>();
    for (const uso of ordenados) {
      for (const a of (uso.detalle as Partial<DetalleUso> | null)?.aplicados ?? []) {
        if (!a.tope_monto || a.tope_periodo === "dia" || vistos.has(a.clave)) continue;
        vistos.add(a.clave);
        const total = acumulado(grupo, a.clave, a.tope_periodo, fecha);
        estados.push({
          clave: `${uso.promo_id}:${uso.tarjeta_id}:${a.clave}`,
          promoTitulo: uso.promo_titulo,
          tarjetaAlias: uso.tarjeta_alias,
          tipo: a.tipo,
          tope: a.tope_monto,
          topeTipo: a.tope_tipo,
          periodo: a.tope_periodo,
          usado: a.tope_tipo === "compra" ? total.base : total.descuento,
        });
      }
    }
  }
  return estados.sort((a, b) => b.usado / b.tope - a.usado / a.tope);
}
