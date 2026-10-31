import { addDaysToDateOnly } from "@/lib/dates";
import { escapeTelegramHtml } from "@/lib/telegram/escape";
import { RUBROS, type Rubro } from "./constants";
import { describirComponente, diaMes, diasEntre, DIAS_VENCE_PRONTO, nombreDia } from "./formato";
import {
  comerciosVigentes,
  porcentajeTotal,
  promosQueAplican,
  tarjetasQueAplican,
  type MatchPromo,
  type PromoParaMatch,
  type TarjetaParaMatch,
} from "./matching";

/**
 * Textos de los avisos de promos por Telegram (Fase 5), funciones puras:
 * reciben las promos activas, las tarjetas de UNA familia y "hoy" en la
 * zona de la familia, y devuelven el mensaje en HTML de Telegram o `null`
 * si no hay nada que decir (el bot solo habla cuando hay algo concreto).
 * El matching es el de la pantalla (`promosQueAplican`): misma promo,
 * misma mejor tarjeta.
 */

export type PromoAviso = PromoParaMatch & {
  id: string;
  titulo: string;
  rubro: string;
  origen: "api" | "web" | "manual";
  comercios: Array<{ comercio_nombre: string; desde: string | null; hasta: string | null }>;
};

export type TarjetaAviso = TarjetaParaMatch & { id: string; alias: string; member_id: string };

/** Telegram corta en 4096 caracteres; con margen para el pie. */
const MAX_MENSAJE = 3800;

function comercios(promo: PromoAviso, fecha: string): string {
  const nombres = comerciosVigentes(promo.comercios, fecha).map((c) => c.comercio_nombre);
  return nombres.length > 0 ? nombres.join(", ") : promo.titulo;
}

function linea(match: MatchPromo<PromoAviso, TarjetaAviso>, fecha: string, nombres: Map<string, string>): string {
  const descuentos = [...new Set(match.beneficio.componentes.map(describirComponente))].join(" + ");
  const duenio = nombres.get(match.tarjeta.member_id);
  return `• <b>${escapeTelegramHtml(comercios(match.promo, fecha))}</b> — ${escapeTelegramHtml(descuentos)} · ${escapeTelegramHtml(
    match.tarjeta.alias,
  )}${duenio ? ` (${escapeTelegramHtml(duenio)})` : ""}`;
}

/** Junta las líneas sin pasarse del largo de Telegram; lo que no entra se remite a la app. */
export function armarMensaje(encabezado: string, lineas: string[], pie: string): string {
  const partes = [encabezado, ""];
  let largo = encabezado.length + pie.length + 2;
  let incluidas = 0;
  for (const l of lineas) {
    if (largo + l.length + 1 > MAX_MENSAJE) break;
    partes.push(l);
    largo += l.length + 1;
    incluidas++;
  }
  const resto = lineas.length - incluidas;
  if (resto > 0) partes.push(`… y ${resto} más en la app`);
  partes.push("", pie);
  return partes.join("\n");
}

function porRubro(
  matches: MatchPromo<PromoAviso, TarjetaAviso>[],
  fecha: string,
  nombres: Map<string, string>,
): string[] {
  const lineas: string[] = [];
  for (const rubro of Object.keys(RUBROS) as Rubro[]) {
    const delRubro = matches
      .filter((m) => m.promo.rubro === rubro)
      .sort((a, b) => porcentajeTotal(b.beneficio) - porcentajeTotal(a.beneficio));
    if (delRubro.length === 0) continue;
    lineas.push(`${RUBROS[rubro].emoji} <b>${RUBROS[rubro].label}</b>`);
    lineas.push(...delRubro.map((m) => linea(m, fecha, nombres)));
  }
  return lineas;
}

/** Resumen diario: las promos de hoy para las tarjetas de la familia, por rubro. */
export function resumenDelDia(
  promos: PromoAviso[],
  tarjetas: TarjetaAviso[],
  hoy: string,
  nombres: Map<string, string>,
  pie: string,
): string | null {
  const matches = promosQueAplican(promos, tarjetas, hoy);
  if (matches.length === 0) return null;
  return armarMensaje(`🏷️ <b>Promos de hoy</b> (${nombreDia(hoy)} ${diaMes(hoy)})`, porRubro(matches, hoy, nombres), pie);
}

/**
 * Víspera: promos que mañana valen por una **fecha puntual** (el primer
 * lunes del mes, "03/07, 07/08…"), no las de todas las semanas — esas ya
 * salen en el resumen diario y avisarlas la noche anterior sería ruido.
 */
export function avisoVispera(
  promos: PromoAviso[],
  tarjetas: TarjetaAviso[],
  hoy: string,
  nombres: Map<string, string>,
  pie: string,
): string | null {
  const manana = addDaysToDateOnly(hoy, 1);
  const matches = promosQueAplican(promos, tarjetas, manana).filter((m) => m.beneficio.fechas?.includes(manana));
  if (matches.length === 0) return null;
  return armarMensaje(
    `⏰ <b>Mañana hay promo</b> (${nombreDia(manana)} ${diaMes(manana)})`,
    porRubro(matches, manana, nombres),
    pie,
  );
}

/**
 * Promos cargadas a mano (PDF, captura o mail) que le sirven a la familia
 * y vencen en 7 días o menos: para buscar la versión nueva a tiempo. Las
 * automáticas no: Itaú se actualiza solo.
 */
export function promosPorVencer(promos: PromoAviso[], tarjetas: TarjetaAviso[], hoy: string): PromoAviso[] {
  return promos.filter((p) => {
    if (p.origen !== "manual" || !p.vigencia_hasta) return false;
    const dias = diasEntre(hoy, p.vigencia_hasta);
    return dias >= 0 && dias <= DIAS_VENCE_PRONTO && tarjetasQueAplican(p, tarjetas).length > 0;
  });
}

export function avisoVencimientos(promos: PromoAviso[], hoy: string, pie: string): string | null {
  if (promos.length === 0) return null;
  const lineas = [...promos]
    .sort((a, b) => (a.vigencia_hasta ?? "").localeCompare(b.vigencia_hasta ?? ""))
    .map((p) => {
      const dias = diasEntre(hoy, p.vigencia_hasta!);
      const cuando = dias === 0 ? "vence hoy" : dias === 1 ? "vence mañana" : `vence el ${diaMes(p.vigencia_hasta!)} (en ${dias} días)`;
      return `• <b>${escapeTelegramHtml(comercios(p, hoy))}</b> — ${cuando}`;
    });
  return armarMensaje(
    "📅 <b>Promos por vencer</b>",
    lineas,
    `Si llega una versión nueva, cargala en la app o reenviá el mail.\n${pie}`,
  );
}

/** Semanal (opcional): por cada uno de los próximos 7 días, los comercios con promo y el mejor porcentaje. */
export function resumenSemanal(
  promos: PromoAviso[],
  tarjetas: TarjetaAviso[],
  hoy: string,
  pie: string,
): string | null {
  const lineas: string[] = [];
  for (let i = 0; i < 7; i++) {
    const fecha = addDaysToDateOnly(hoy, i);
    const matches = promosQueAplican(promos, tarjetas, fecha).sort(
      (a, b) => porcentajeTotal(b.beneficio) - porcentajeTotal(a.beneficio),
    );
    if (matches.length === 0) continue;
    const items = matches.map((m) => {
      const pct = porcentajeTotal(m.beneficio);
      return `${escapeTelegramHtml(comercios(m.promo, fecha))}${pct > 0 ? ` (${pct}%)` : ""}`;
    });
    lineas.push(`<b>${nombreDia(fecha)} ${diaMes(fecha)}</b>: ${items.join(", ")}`);
  }
  if (lineas.length === 0) return null;
  return armarMensaje("🗓️ <b>Promos de la semana</b>", lineas, pie);
}
