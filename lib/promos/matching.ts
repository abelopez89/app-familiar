import { dayOfWeekOfDateOnly } from "@/lib/dates";
import { normalizarAfinidad, normalizarBanco, normalizarMarca, normalizarNivel, normalizarTipo } from "./normalize";

/**
 * Matching entre las tarjetas de la familia y las promos (funciones puras).
 *
 * Las promos se guardan sin mirar las tarjetas; este archivo es el único
 * lugar que decide qué promo le sirve a qué tarjeta, y lo usan la pantalla
 * y los avisos de Telegram. Fechas como texto "yyyy-MM-dd" en la zona de la
 * familia, con aritmética de calendario (`dayOfWeekOfDateOnly`), nunca con
 * la zona del servidor.
 */

export type TarjetaParaMatch = {
  banco: string;
  marca: string;
  nivel: string;
  afinidad: string | null;
  tipo: string;
};

export type ReglaTarjeta = {
  regla: "incluye" | "excluye";
  marca: string | null;
  nivel: string | null;
  afinidad: string | null;
  tipo: string | null;
};

export type ComponenteBeneficio = {
  tipo: "descuento_caja" | "reintegro" | "descuento_monto" | "cuotas";
  porcentaje: number | null;
  monto: number | null;
  cuotas: number | null;
  es_hasta: boolean;
  alcance: string | null;
  tope_monto: number | null;
  tope_periodo: "dia" | "mes" | "promo" | null;
  tope_alcance: string | null;
};

export type BeneficioParaMatch = {
  nombre: string;
  /** 0 = domingo … 6 = sábado. */
  dias_semana: number[] | null;
  fechas: string[] | null;
  prioridad: number;
  componentes: ComponenteBeneficio[];
  tarjetas: ReglaTarjeta[];
};

export type PromoParaMatch = {
  banco: string;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  beneficios: BeneficioParaMatch[];
};

function igual(valorRegla: string | null, valorTarjeta: string | null, normalizar: (v: string | null) => string | null) {
  if (valorRegla === null) return true; // comodín
  return normalizar(valorRegla) === normalizar(valorTarjeta);
}

/** Una regla coincide si cada campo no nulo es igual al de la tarjeta. */
export function reglaCoincide(regla: ReglaTarjeta, tarjeta: TarjetaParaMatch): boolean {
  return (
    igual(regla.marca, tarjeta.marca, normalizarMarca) &&
    igual(regla.nivel, tarjeta.nivel, normalizarNivel) &&
    igual(regla.afinidad, tarjeta.afinidad, normalizarAfinidad) &&
    igual(regla.tipo, tarjeta.tipo, normalizarTipo)
  );
}

/**
 * Una tarjeta aplica a un beneficio si es del banco de la promo, ninguna
 * regla `excluye` coincide (la exclusión siempre gana) y coincide alguna
 * `incluye` — o no hay ninguna `incluye`, y entonces aplica a todas las de
 * crédito del banco.
 */
export function tarjetaAplica(banco: string, reglas: ReglaTarjeta[], tarjeta: TarjetaParaMatch): boolean {
  if (normalizarBanco(banco) !== normalizarBanco(tarjeta.banco)) return false;
  if (reglas.some((r) => r.regla === "excluye" && reglaCoincide(r, tarjeta))) return false;
  const incluye = reglas.filter((r) => r.regla === "incluye");
  if (incluye.length === 0) return normalizarTipo(tarjeta.tipo) === "credito";
  return incluye.some((r) => reglaCoincide(r, tarjeta));
}

export function promoVigenteEn(promo: PromoParaMatch, fecha: string): boolean {
  if (!promo.activa) return false;
  if (promo.vigencia_desde && fecha < promo.vigencia_desde) return false;
  if (promo.vigencia_hasta && fecha > promo.vigencia_hasta) return false;
  return true;
}

/**
 * Una capa vale en una fecha si la fecha está entre las explícitas o cae
 * en uno de sus días de la semana. Sin días ni fechas, vale todos los días
 * de la vigencia.
 */
export function beneficioValeEn(beneficio: BeneficioParaMatch, fecha: string): boolean {
  const sinDias = !beneficio.dias_semana || beneficio.dias_semana.length === 0;
  const sinFechas = !beneficio.fechas || beneficio.fechas.length === 0;
  if (sinDias && sinFechas) return true;
  if (!sinFechas && beneficio.fechas!.includes(fecha)) return true;
  if (!sinDias && beneficio.dias_semana!.includes(dayOfWeekOfDateOnly(fecha))) return true;
  return false;
}

/** Suma de porcentajes de la capa: desempata capas de igual prioridad. */
export function porcentajeTotal(beneficio: Pick<BeneficioParaMatch, "componentes">): number {
  return beneficio.componentes.reduce((sum, c) => sum + (c.tipo === "cuotas" ? 0 : (c.porcentaje ?? 0)), 0);
}

/**
 * La capa que le toca a una tarjeta en una fecha, o null si la promo no le
 * sirve ese día. Si varias capas valen, gana la de mayor prioridad
 * (Farmacenter: la Especial reemplaza a la General); con la misma
 * prioridad, la de mayor porcentaje.
 */
export function beneficioDelDia<P extends PromoParaMatch>(
  promo: P,
  tarjeta: TarjetaParaMatch,
  fecha: string,
): P["beneficios"][number] | null {
  if (!promoVigenteEn(promo, fecha)) return null;
  const candidatos = promo.beneficios.filter(
    (b) => beneficioValeEn(b, fecha) && tarjetaAplica(promo.banco, b.tarjetas, tarjeta),
  );
  if (candidatos.length === 0) return null;
  return candidatos.reduce((mejor, b) =>
    b.prioridad > mejor.prioridad || (b.prioridad === mejor.prioridad && porcentajeTotal(b) > porcentajeTotal(mejor))
      ? b
      : mejor,
  );
}

export type MatchPromo<P extends PromoParaMatch, T extends TarjetaParaMatch> = {
  promo: P;
  tarjeta: T;
  beneficio: P["beneficios"][number];
};

/**
 * Para cada promo, la mejor tarjeta de la familia en esa fecha (la de capa
 * con mayor porcentaje). Una promo sin ninguna tarjeta que aplique no
 * aparece: es el filtro de "solo lo que le sirve a la familia".
 */
export function promosQueAplican<P extends PromoParaMatch, T extends TarjetaParaMatch>(
  promos: P[],
  tarjetas: T[],
  fecha: string,
): MatchPromo<P, T>[] {
  const resultado: MatchPromo<P, T>[] = [];
  for (const promo of promos) {
    let mejor: MatchPromo<P, T> | null = null;
    for (const tarjeta of tarjetas) {
      const beneficio = beneficioDelDia(promo, tarjeta, fecha);
      if (beneficio && (!mejor || porcentajeTotal(beneficio) > porcentajeTotal(mejor.beneficio))) {
        mejor = { promo, tarjeta, beneficio };
      }
    }
    if (mejor) resultado.push(mejor);
  }
  return resultado;
}

/** Comercios de la promo vigentes en la fecha (cada uno con su ventana propia). */
export function comerciosVigentes<C extends { comercio_nombre: string; desde: string | null; hasta: string | null }>(
  comercios: C[],
  fecha: string,
): C[] {
  return comercios.filter((c) => (!c.desde || fecha >= c.desde) && (!c.hasta || fecha <= c.hasta));
}
