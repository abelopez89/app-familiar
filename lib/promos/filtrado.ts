import type { Rubro } from "./constants";
import { RUBROS } from "./constants";
import type { BeneficioNormalizado, ComponenteNormalizado, PromoNormalizada, ReglaNormalizada } from "./esquema";
import { normalizarAfinidad, normalizarMarca, normalizarNivel, normalizarTipo } from "./normalize";

/**
 * Reglas de filtrado después de la normalización (funciones puras), las
 * mismas para todas las fuentes:
 *
 * 1. Solo promos con descuento: un componente con porcentaje (en caja o
 *    reintegro) o con monto fijo. Las cuotas se guardan solo como dato
 *    extra de una capa que ya tiene descuento; una capa que es solo
 *    cuotas se descarta (Sudameris "12 cuotas en electro/jardín/deco").
 * 2. Solo los cuatro rubros. `otro` se descarta.
 *
 * Además sanea lo que el esquema no puede garantizar: fechas válidas,
 * días 0–6, porcentajes en rango, marca/nivel/afinidad/tipo normalizados.
 */

export type PromoFiltrada = Omit<PromoNormalizada, "rubro"> & { rubro: Rubro };

export type ResultadoFiltrado =
  | { ok: true; promos: PromoFiltrada[] }
  | { ok: false; motivo: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(value: string | null): string | null {
  if (!value || !FECHA.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value : null;
}

function positivo(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function sanearComponente(c: ComponenteNormalizado): ComponenteNormalizado | null {
  const porcentaje = positivo(c.porcentaje);
  const componente: ComponenteNormalizado = {
    ...c,
    porcentaje: porcentaje != null && porcentaje <= 100 ? porcentaje : null,
    monto: positivo(c.monto) != null ? Math.round(c.monto!) : null,
    cuotas: positivo(c.cuotas) != null ? Math.round(c.cuotas!) : null,
    tope_monto: positivo(c.tope_monto) != null ? Math.round(c.tope_monto!) : null,
    alcance: c.alcance?.trim() || null,
    tope_alcance: c.tope_alcance?.trim() || null,
  };
  if (componente.tipo === "cuotas") return componente.cuotas ? componente : null;
  if (componente.tipo === "descuento_monto") return componente.monto ? componente : null;
  return componente.porcentaje ? componente : null;
}

function sanearRegla(r: ReglaNormalizada): ReglaNormalizada {
  const tipo = normalizarTipo(r.tipo);
  return {
    regla: r.regla,
    marca: normalizarMarca(r.marca),
    nivel: normalizarNivel(r.nivel),
    afinidad: normalizarAfinidad(r.afinidad),
    tipo: tipo === "credito" || tipo === "debito" || tipo === "prepaga" ? tipo : null,
  };
}

export function tieneDescuento(componentes: ComponenteNormalizado[]): boolean {
  return componentes.some((c) => c.tipo !== "cuotas" && (c.porcentaje != null || c.monto != null));
}

function sanearBeneficio(b: BeneficioNormalizado): BeneficioNormalizado | null {
  const componentes = b.componentes.map(sanearComponente).filter((c): c is ComponenteNormalizado => c !== null);
  if (!tieneDescuento(componentes)) return null;
  const dias = b.dias_semana ? [...new Set(b.dias_semana.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : null;
  const fechas = b.fechas ? [...new Set(b.fechas.map(fechaValida).filter((f): f is string => f !== null))].sort() : null;
  return {
    nombre: b.nombre.trim() || "General",
    dias_semana: dias && dias.length > 0 ? dias : null,
    fechas: fechas && fechas.length > 0 ? fechas : null,
    prioridad: Number.isInteger(b.prioridad) ? b.prioridad : 0,
    componentes,
    tarjetas: b.tarjetas.map(sanearRegla),
  };
}

export function filtrarPromo(promo: PromoNormalizada): ResultadoFiltrado {
  if (!(promo.rubro in RUBROS)) return { ok: false, motivo: "rubro fuera de alcance" };
  const beneficios = promo.beneficios.map(sanearBeneficio).filter((b): b is BeneficioNormalizado => b !== null);
  if (beneficios.length === 0) return { ok: false, motivo: "sin descuento (solo cuotas, sorteo o puntos)" };

  let desde = fechaValida(promo.vigencia_desde);
  let hasta = fechaValida(promo.vigencia_hasta);
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];

  return {
    ok: true,
    promos: [
      {
        ...promo,
        rubro: promo.rubro as Rubro,
        titulo: promo.titulo.trim(),
        resumen: promo.resumen.trim(),
        canal: promo.canal?.trim() || null,
        vigencia_desde: desde,
        vigencia_hasta: hasta,
        comercios: promo.comercios
          .filter((c) => c.nombre.trim())
          .map((c) => ({ nombre: c.nombre.trim(), desde: fechaValida(c.desde), hasta: fechaValida(c.hasta) })),
        beneficios,
      },
    ],
  };
}

/** Todas las promos de una normalización; el motivo es el de la primera descartada si no queda ninguna. */
export function filtrarPromos(promos: PromoNormalizada[]): ResultadoFiltrado {
  const aceptadas: PromoFiltrada[] = [];
  let motivo = "el modelo no devolvió ninguna promo";
  for (const promo of promos) {
    const r = filtrarPromo(promo);
    if (r.ok) aceptadas.push(...r.promos);
    else if (aceptadas.length === 0) motivo = r.motivo;
  }
  return aceptadas.length > 0 ? { ok: true, promos: aceptadas } : { ok: false, motivo };
}
