import "server-only";
import { cache } from "react";
import { getCurrentFamilyContext } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";
import { listEventsWithDetails } from "@/lib/events/queries";
import { listActiveMembers } from "@/lib/members";
import { buildDisplayEvents } from "@/lib/events/view-model";
import { getOpenShoppingList } from "@/lib/shopping/queries";
import { listItems } from "@/lib/services/compras";
import { listFuelLogs, listVehicles } from "@/lib/fuel/queries";
import { computeFuelIntervals } from "@/lib/fuel/consumption";
import { getFuelUnit } from "@/lib/fuel/unit";
import { listDocumentsWithExpiry } from "@/lib/documents/queries";
import { listAssets } from "@/lib/tasks/queries";
import { getGroupBundle, listGroupSummaries } from "@/lib/expenses/queries";
import { reintegrosPendientes, usosEntre } from "@/lib/promos/usos";
import { ventanaTope } from "@/lib/promos/ahorro";
import { listarPromosActivas, listarTarjetasActivas } from "@/lib/promos/queries";
import { porcentajeTotal, promosQueAplican } from "@/lib/promos/matching";
import { diasEntre } from "@/lib/promos/formato";
import {
  addDaysToDateOnly,
  addMonthsToDateOnly,
  dateOnlyInFamilyTimezone,
  dateOnlyToFamilyMidnightUtc,
  todayInFamilyTimezone,
} from "@/lib/dates";

/*
 * Datos del tablero de escritorio del inicio. Solo los pide el tablero,
 * que el inicio no arma para un teléfono (`isPhoneRequest`). Cada loader
 * está envuelto en `cache()`: el indicador y el bloque que comparten
 * datos (la semana, los vencimientos, los gastos) hacen una sola consulta
 * por request. Todo sale de consultas y cálculos que ya existen; acá no
 * hay reglas nuevas.
 */

export const DIAS_SEMANA = 7;
export const DIAS_VENCIMIENTO = 30;
const TRAMOS_COMBUSTIBLE = 10;

/** Eventos de hoy y los 6 días siguientes, con recurrencia y cumpleaños (`buildDisplayEvents`). */
export const datosSemana = cache(async function datosSemana() {
  const today = todayInFamilyTimezone();
  const [events, members] = await Promise.all([listEventsWithDetails(), listActiveMembers()]);
  const display = buildDisplayEvents(
    events,
    members,
    dateOnlyToFamilyMidnightUtc(today),
    dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, DIAS_SEMANA)),
  );
  const days = Array.from({ length: DIAS_SEMANA }, (_, i) => addDaysToDateOnly(today, i));
  // Un evento que empezó antes de hoy y sigue en curso cuenta en "hoy",
  // una sola vez (mismo criterio que `/semana` en el bot).
  const byDay = new Map(days.map((d) => [d, [] as typeof display]));
  for (const event of display) {
    const day = dateOnlyInFamilyTimezone(event.starts_at);
    byDay.get(day < today ? today : day)?.push(event);
  }
  const now = Date.now();
  const next = display.find((e) =>
    e.all_day ? dateOnlyInFamilyTimezone(e.starts_at) >= today : e.starts_at.getTime() >= now,
  );
  return { today, days, byDay, total: display.length, next: next ?? null };
});

export const datosLista = cache(async function datosLista() {
  const [context, list] = await Promise.all([getCurrentFamilyContext(), getOpenShoppingList()]);
  if (!context || !list) return null;
  const supabase = await createClient();
  const items = await listItems(supabase, context.family.id, list.id);
  return { list, items };
});

/** Último vehículo cargado (por fecha de carga), con sus últimos tramos entre tanques llenos. */
export const datosCombustible = cache(async function datosCombustible() {
  const [vehicles, unit] = await Promise.all([listVehicles(), getFuelUnit()]);
  if (vehicles.length === 0) return { unit, vehicle: null, vehicleCount: 0 } as const;
  const logsByVehicle = await Promise.all(vehicles.map((v) => listFuelLogs(v.id)));
  const lastFill = (i: number) =>
    logsByVehicle[i].reduce((max, l) => (l.filled_at > max ? l.filled_at : max), "");
  let pick = 0;
  vehicles.forEach((_, i) => {
    if (lastFill(i) > lastFill(pick)) pick = i;
  });
  const logs = logsByVehicle[pick];
  const intervals = computeFuelIntervals(logs).slice(-TRAMOS_COMBUSTIBLE);
  const km = intervals.reduce((s, i) => s + i.km, 0);
  return {
    unit,
    vehicleCount: vehicles.length,
    vehicle: vehicles[pick],
    intervals,
    logDates: Object.fromEntries(logs.map((l) => [l.id, l.filled_at])),
    last: intervals[intervals.length - 1] ?? null,
    averageKmPerLiter: intervals.length > 0 ? intervals.reduce((s, i) => s + i.kmPerLiter, 0) / intervals.length : null,
    costPerKm: km > 0 ? intervals.reduce((s, i) => s + i.totalAmount, 0) / km : null,
  } as const;
});

export type Vencimiento = {
  id: string;
  kind: "documento" | "garantia";
  title: string;
  date: string;
  /** Negativo: ya venció. */
  days: number;
  href: string;
};

/**
 * Documentos que vencen en 30 días o ya vencidos, y garantías de activos
 * que vencen en 30 días (una garantía vencida ya no pide nada).
 */
export const datosVencimientos = cache(async function datosVencimientos() {
  const today = todayInFamilyTimezone();
  const limit = addDaysToDateOnly(today, DIAS_VENCIMIENTO);
  const [docs, assets] = await Promise.all([listDocumentsWithExpiry(), listAssets()]);
  const items: Vencimiento[] = [
    ...docs
      .filter((d) => d.expires_at! <= limit)
      .map((d) => ({
        id: d.id,
        kind: "documento" as const,
        title: d.title,
        date: d.expires_at!,
        days: diasEntre(today, d.expires_at!),
        href: `/documentos/${d.id}`,
      })),
    ...assets
      .filter((a) => a.warranty_until && a.warranty_until >= today && a.warranty_until <= limit)
      .map((a) => ({
        id: a.id,
        kind: "garantia" as const,
        title: `Garantía: ${a.name}`,
        date: a.warranty_until!,
        days: diasEntre(today, a.warranty_until!),
        href: `/tareas/activos/${a.id}`,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const docsSoon = items.filter((i) => i.kind === "documento" && i.days >= 0).length;
  const docsExpired = items.filter((i) => i.kind === "documento" && i.days < 0).length;
  return { items, docsSoon, docsExpired };
});

/** Tu balance en los grupos abiertos y el detalle del grupo abierto más reciente. */
export const datosGastos = cache(async function datosGastos() {
  const context = await getCurrentFamilyContext();
  if (!context) return null;
  // Ya vienen del más nuevo al más viejo (`created_at` descendente).
  const open = (await listGroupSummaries(context.member.id)).filter((s) => s.group.status === "abierto");
  const mine = open.filter((s) => s.myBalance !== null);
  const myTotal = mine.reduce((s, g) => s + (g.myBalance ?? 0), 0);
  const latest = open[0] ? await getGroupBundle(open[0].group.id) : null;
  return {
    openCount: open.length,
    myGroups: mine.length,
    myTotal,
    allConsistent: mine.every((s) => s.isConsistent),
    latest,
  };
});

/**
 * Descuentos con promos del mes en curso (en caja y reintegros), el total
 * del mes anterior para comparar y los reintegros por acreditar. Misma
 * cuenta que `/promos/ahorros`. Una sola consulta de usos: desde el 1 del
 * mes anterior hasta fin de este mes, repartida en memoria.
 */
export const datosAhorro = cache(async function datosAhorro() {
  const context = await getCurrentFamilyContext();
  if (!context) return null;
  const hoy = todayInFamilyTimezone();
  const mes = `${hoy.slice(0, 7)}-01`;
  const mesAnterior = addMonthsToDateOnly(mes, -1);
  const ventana = ventanaTope("mes", mes)!;
  const [usos, pendientes] = await Promise.all([
    usosEntre(context.family.id, mesAnterior, ventana.hasta),
    reintegrosPendientes(context.family.id),
  ]);
  const delMes = usos.filter((u) => u.fecha >= mes);
  const anteriores = usos.filter((u) => u.fecha < mes);
  const caja = delMes.reduce((s, u) => s + u.descuento_caja, 0);
  const reintegro = delMes.reduce((s, u) => s + u.reintegro, 0);
  return {
    mes,
    mesAnterior,
    caja,
    reintegro,
    total: caja + reintegro,
    usos: delMes.length,
    totalAnterior: anteriores.reduce((s, u) => s + u.descuento_caja + u.reintegro, 0),
    porAcreditar: pendientes.reduce((s, u) => s + u.reintegro, 0),
  };
});

/** Promos de hoy para las tarjetas de la familia (`promosQueAplican`, igual que `/promos`). */
export const datosPromos = cache(async function datosPromos() {
  const hoy = todayInFamilyTimezone();
  const [promos, tarjetas, members] = await Promise.all([
    listarPromosActivas(hoy),
    listarTarjetasActivas(),
    listActiveMembers(),
  ]);
  const matches = promosQueAplican(promos, tarjetas, hoy).sort(
    (a, b) => porcentajeTotal(b.beneficio) - porcentajeTotal(a.beneficio),
  );
  return { hoy, hasCards: tarjetas.length > 0, matches, members };
});
