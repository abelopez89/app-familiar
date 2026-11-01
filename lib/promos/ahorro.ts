import type { ComponenteBeneficio } from "./matching";

/**
 * Cálculo del descuento de una promo sobre una compra o carga de
 * combustible (migración 015, `promo_usos`). Funciones puras: las usan
 * la pantalla (vista previa al elegir la promo) y el guardado, que
 * vuelve a calcular en el servidor y guarda una copia en `detalle`.
 *
 * - Se parte del monto BRUTO (antes del descuento): la app dice cuánto
 *   deberían cobrar en caja, para controlar que el cajero aplicó la promo.
 * - Los componentes de una capa se suman (descuento en caja + reintegro);
 *   las cuotas no mueven plata y se ignoran.
 * - Tope por tarjeta (pedido del usuario): el acumulado sale de los usos
 *   anteriores de la misma promo con la misma tarjeta, dentro del período
 *   del tope (día, mes calendario o toda la promo).
 * - `tope_tipo` dice si el tope limita la COMPRA sobre la que se aplica
 *   el porcentaje o el DESCUENTO. Sin dato (promos viejas), se toma como
 *   tope de descuento —lo más común en reintegros— y se marca
 *   `topeDudoso` para que la pantalla avise que conviene corregir la promo.
 * - Guaraníes enteros: cada descuento se redondea, y el total nunca pasa
 *   el monto bruto.
 */

export type TopeTipo = "compra" | "descuento";

export type ComponenteConTope = ComponenteBeneficio & { tope_tipo: TopeTipo | null };

export type Aplicado = {
  clave: string;
  tipo: ComponenteBeneficio["tipo"];
  porcentaje: number | null;
  monto: number | null;
  alcance: string | null;
  base: number;
  descuento: number;
  tope_monto: number | null;
  tope_tipo: TopeTipo | null;
  tope_periodo: ComponenteBeneficio["tope_periodo"];
  /** Cuánto queda del tope después de esta compra (null sin tope). */
  restante: number | null;
  topeAlcanzado: boolean;
  topeDudoso: boolean;
};

export type DetalleUso = { beneficio: string; aplicados: Aplicado[] };

export type UsoAnterior = { id: string; fecha: string; detalle: Partial<DetalleUso> | null };

export type Calculo = {
  aplicados: Aplicado[];
  descuentoCaja: number;
  reintegro: number;
  montoCaja: number;
  costoFinal: number;
};

/** Identifica un componente entre usos aunque la promo se edite: tipo, alcance y período. */
export function claveComponente(c: Pick<ComponenteBeneficio, "tipo" | "alcance" | "tope_periodo">): string {
  return [c.tipo, (c.alcance ?? "").trim().toLowerCase(), c.tope_periodo ?? ""].join("|");
}

/** Los componentes que se aplican por defecto: los que valen para toda la compra (sin alcance). */
export function seleccionPorDefecto(componentes: ComponenteBeneficio[]): number[] {
  return componentes.flatMap((c, i) => (c.tipo !== "cuotas" && !c.alcance ? [i] : []));
}

/** Rango de fechas `yyyy-MM-dd` que cuenta para un tope; null = toda la promo. */
export function ventanaTope(
  periodo: ComponenteBeneficio["tope_periodo"],
  fecha: string,
): { desde: string; hasta: string } | null {
  if (periodo === "dia") return { desde: fecha, hasta: fecha };
  if (periodo === "mes") {
    const [y, m] = fecha.split("-").map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, "0");
    return { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-${String(ultimo).padStart(2, "0")}` };
  }
  return null;
}

/** Base y descuento ya usados de un componente en la ventana de su tope. */
export function acumulado(
  usos: UsoAnterior[],
  clave: string,
  periodo: ComponenteBeneficio["tope_periodo"],
  fecha: string,
  excluirId?: string,
): { base: number; descuento: number } {
  const ventana = ventanaTope(periodo, fecha);
  let base = 0;
  let descuento = 0;
  for (const uso of usos) {
    if (uso.id === excluirId) continue;
    if (ventana && (uso.fecha < ventana.desde || uso.fecha > ventana.hasta)) continue;
    for (const a of uso.detalle?.aplicados ?? []) {
      if (a.clave !== clave) continue;
      base += a.base;
      descuento += a.descuento;
    }
  }
  return { base, descuento };
}

export function calcularDescuento(input: {
  montoBruto: number;
  componentes: ComponenteConTope[];
  seleccion: number[];
  usosAnteriores: UsoAnterior[];
  fecha: string;
  /** Al editar un uso, el propio no cuenta para el acumulado. */
  excluirId?: string;
}): Calculo {
  const bruto = Math.max(0, Math.round(input.montoBruto));
  const aplicados: Aplicado[] = [];

  for (const [i, c] of input.componentes.entries()) {
    if (c.tipo === "cuotas" || !input.seleccion.includes(i)) continue;
    const clave = claveComponente(c);
    const tope = c.tope_monto && c.tope_monto > 0 ? c.tope_monto : null;
    const topeTipo: TopeTipo | null = c.tope_tipo ?? null;
    const tipoEfectivo: TopeTipo = topeTipo ?? "descuento";
    const previo = tope ? acumulado(input.usosAnteriores, clave, c.tope_periodo, input.fecha, input.excluirId) : null;

    let base = bruto;
    if (tope && tipoEfectivo === "compra") base = Math.min(bruto, Math.max(0, tope - previo!.base));

    let descuento =
      c.tipo === "descuento_monto"
        ? Math.min(base, Math.round(c.monto ?? 0))
        : Math.round((base * (c.porcentaje ?? 0)) / 100);
    if (tope && tipoEfectivo === "descuento") descuento = Math.min(descuento, Math.max(0, tope - previo!.descuento));

    const restante = tope
      ? tipoEfectivo === "compra"
        ? tope - previo!.base - base
        : tope - previo!.descuento - descuento
      : null;
    aplicados.push({
      clave,
      tipo: c.tipo,
      porcentaje: c.porcentaje,
      monto: c.monto,
      alcance: c.alcance,
      base,
      descuento,
      tope_monto: tope,
      tope_tipo: topeTipo,
      tope_periodo: c.tope_periodo,
      restante,
      topeAlcanzado: restante !== null && restante <= 0,
      topeDudoso: tope !== null && topeTipo === null,
    });
  }

  // El total de descuentos nunca pasa el bruto: se recorta lo último.
  let disponible = bruto;
  for (const a of aplicados) {
    a.descuento = Math.min(a.descuento, disponible);
    disponible -= a.descuento;
  }

  const descuentoCaja = aplicados.filter((a) => a.tipo !== "reintegro").reduce((s, a) => s + a.descuento, 0);
  const reintegro = aplicados.filter((a) => a.tipo === "reintegro").reduce((s, a) => s + a.descuento, 0);
  return {
    aplicados,
    descuentoCaja,
    reintegro,
    montoCaja: bruto - descuentoCaja,
    costoFinal: bruto - descuentoCaja - reintegro,
  };
}
