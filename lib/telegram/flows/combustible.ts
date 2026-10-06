import "server-only";
import { escapeTelegramHtml } from "@/lib/telegram/client";
import { button, CANCEL_BUTTON, keyboard, shortLabel } from "@/lib/telegram/keyboards";
import { claimDialog, clearDialog, setDialog } from "@/lib/telegram/session";
import { show, type BotContext } from "@/lib/telegram/context";
import { expiredDialog } from "@/lib/telegram/router";
import { formatGuaranies } from "@/lib/format";
import { formatEfficiency } from "@/lib/fuel/efficiency";
import {
  createFuelLog,
  getLastFuelLog,
  getLastUsedVehicleId,
  getVehicle,
  listVehicles,
} from "@/lib/services/combustible";
import type { Vehicle } from "@/lib/supabase/types";

// Carga de combustible por Telegram (`/nafta`):
//   vehículo (se saltea si hay uno) → odómetro → litros → monto → ¿tanque lleno?
//
// Las validaciones son las de la pantalla, a través del mismo servicio
// (`createFuelLog` en lib/services/combustible.ts): odómetro duplicado,
// carga anterior a la última, litros contra la capacidad del tanque,
// salto de kilometraje y rendimiento implausible. Si el rendimiento da
// implausible se ofrece "me olvidé de registrar una carga anterior"
// (`resets_calculation`), en lenguaje humano, nunca el nombre técnico.
//
// Callbacks:
//   fv:<vehicleId>  elegir vehículo     fm   sin monto
//   fl:1 / fl:0     tanque lleno o no   fs   guardar
//   fo              guardar igual       fr   "me olvidé de una carga anterior"
//   fk              corregir kilometraje

type NaftaDraft = {
  vehicleId: string;
  odometer?: number;
  liters?: number;
  totalAmount?: number | null;
  isFullTank?: boolean;
  resetsCalculation: boolean;
  /** Corrigiendo el kilometraje después de una advertencia: vuelve directo al resumen. */
  editing?: boolean;
};

function draftOf(ctx: BotContext): NaftaDraft {
  return ctx.session.context as unknown as NaftaDraft;
}

function saveDraft(ctx: BotContext, state: string, draft: NaftaDraft) {
  setDialog(ctx.session, state, draft as unknown as Record<string, unknown>);
}

function header(vehicle: Vehicle): string {
  return `⛽ <b>${escapeTelegramHtml(vehicle.name)}</b>`;
}

function km(value: number): string {
  return `${value.toLocaleString("es-PY")} km`;
}

function liters(value: number): string {
  return `${value.toLocaleString("es-PY", { maximumFractionDigits: 3 })} L`;
}

export async function startNafta(ctx: BotContext): Promise<void> {
  const [vehicles, lastUsed] = await Promise.all([
    listVehicles(ctx.db, ctx.actor.familyId),
    getLastUsedVehicleId(ctx.db, ctx.actor.familyId, ctx.actor.memberId),
  ]);
  if (vehicles.length === 0) {
    await show(ctx, "No hay vehículos cargados. Agregá uno desde la app, en <b>Combustible → Vehículos</b>.");
    return;
  }
  if (vehicles.length === 1) {
    await askOdometer(ctx, vehicles[0], { vehicleId: vehicles[0].id, resetsCalculation: false });
    return;
  }
  // El último que usó esta persona va primero (mismo criterio que la app).
  const ordered = [...vehicles].sort((a, b) => Number(b.id === lastUsed) - Number(a.id === lastUsed));
  setDialog(ctx.session, "nafta:vehiculo", {});
  await show(
    ctx,
    "⛽ ¿Qué vehículo cargaste?",
    keyboard([...ordered.map((v) => [button(shortLabel(v.name), `fv:${v.id}`)]), [CANCEL_BUTTON]]),
  );
}

async function askOdometer(ctx: BotContext, vehicle: Vehicle, draft: NaftaDraft, error?: string) {
  const last = await getLastFuelLog(ctx.db, ctx.actor.familyId, vehicle.id);
  saveDraft(ctx, "nafta:odometro", draft);
  await show(
    ctx,
    `${header(vehicle)}\n` +
      (error ? `⚠️ ${escapeTelegramHtml(error)}\n\n` : "") +
      "¿Qué marca el odómetro?" +
      (last ? ` (última carga: ${km(last.odometer)})` : ""),
    keyboard([[CANCEL_BUTTON]]),
  );
}

async function askLiters(ctx: BotContext, vehicle: Vehicle, draft: NaftaDraft, error?: string) {
  saveDraft(ctx, "nafta:litros", draft);
  await show(
    ctx,
    `${header(vehicle)} · ${km(draft.odometer!)}\n` +
      (error ? `⚠️ ${escapeTelegramHtml(error)}\n\n` : "") +
      "¿Cuántos litros cargaste?",
    keyboard([[CANCEL_BUTTON]]),
  );
}

async function askAmount(ctx: BotContext, vehicle: Vehicle, draft: NaftaDraft, error?: string) {
  saveDraft(ctx, "nafta:monto", draft);
  await show(
    ctx,
    `${header(vehicle)} · ${km(draft.odometer!)} · ${liters(draft.liters!)}\n` +
      (error ? `⚠️ ${escapeTelegramHtml(error)}\n\n` : "") +
      "¿Cuánto pagaste, en guaraníes?",
    keyboard([[button("Sin monto", "fm")], [CANCEL_BUTTON]]),
  );
}

async function askFullTank(ctx: BotContext, vehicle: Vehicle, draft: NaftaDraft) {
  saveDraft(ctx, "nafta:lleno", draft);
  await show(
    ctx,
    `${header(vehicle)} · ${km(draft.odometer!)} · ${liters(draft.liters!)}\n\n¿Llenaste el tanque?`,
    keyboard([[button("Sí, tanque lleno", "fl:1"), button("No", "fl:0")], [CANCEL_BUTTON]]),
  );
}

function summary(vehicle: Vehicle, draft: NaftaDraft): string {
  return [
    header(vehicle),
    "",
    `Odómetro: ${km(draft.odometer!)}`,
    `Litros: ${liters(draft.liters!)}`,
    `Monto: ${draft.totalAmount != null ? formatGuaranies(draft.totalAmount) : "sin cargar"}`,
    `Tanque lleno: ${draft.isFullTank ? "sí" : "no"}`,
    ...(draft.resetsCalculation ? ["Me olvidé de registrar una carga anterior: sí"] : []),
  ].join("\n");
}

async function showConfirmation(ctx: BotContext, vehicle: Vehicle, draft: NaftaDraft) {
  draft = { ...draft, editing: false };
  saveDraft(ctx, "nafta:confirmar", draft);
  await show(ctx, summary(vehicle, draft), keyboard([[button("✅ Guardar", "fs")], [CANCEL_BUTTON]]));
}

/**
 * Guarda pasando por el servicio. Sin `confirmed`, el servicio devuelve
 * las advertencias sin guardar; el borrador vuelve al paso de
 * confirmación para que los botones de la respuesta sigan sirviendo.
 */
async function save(ctx: BotContext, vehicle: Vehicle, draft: NaftaDraft, confirmed: boolean) {
  const outcome = await createFuelLog(ctx.db, ctx.actor, {
    vehicleId: vehicle.id,
    odometer: draft.odometer!,
    liters: draft.liters!,
    totalAmount: draft.totalAmount ?? null,
    isFullTank: !!draft.isFullTank,
    resetsCalculation: draft.resetsCalculation,
    confirmed,
  });

  if (outcome.status === "error") {
    saveDraft(ctx, "nafta:confirmar", draft);
    await show(
      ctx,
      `${summary(vehicle, draft)}\n\n⚠️ ${escapeTelegramHtml(outcome.error)}`,
      keyboard([[button("✏️ Corregir kilometraje", "fk")], [CANCEL_BUTTON]]),
    );
    return;
  }

  if (outcome.status === "warnings") {
    saveDraft(ctx, "nafta:confirmar", draft);
    const implausible = outcome.warnings.some((w) => w.code === "implausible_efficiency");
    await show(
      ctx,
      `${summary(vehicle, draft)}\n\n` + outcome.warnings.map((w) => `⚠️ ${escapeTelegramHtml(w.message)}`).join("\n\n"),
      keyboard([
        implausible && !draft.resetsCalculation
          ? [button("Me olvidé de registrar una carga anterior", "fr")]
          : [],
        [button("✅ Guardar igual", "fo"), button("✏️ Corregir km", "fk")],
        [CANCEL_BUTTON],
      ]),
    );
    return;
  }

  const lines = [
    `✅ Carga guardada: ${header(vehicle)}`,
    `${km(draft.odometer!)} · ${liters(draft.liters!)}${draft.totalAmount != null ? ` · ${formatGuaranies(draft.totalAmount)}` : ""}`,
    "",
  ];
  if (outcome.interval) {
    const i = outcome.interval;
    lines.push(
      `Rendimiento del tramo: <b>${formatEfficiency(i.kmPerLiter, "l100km")}</b> (${formatEfficiency(i.kmPerLiter, "kml")})`,
      `${km(i.km)}${i.totalAmount > 0 ? ` · ${formatGuaranies(i.costPerKm)} por km` : ""}`,
    );
  } else if (draft.isFullTank) {
    lines.push("Todavía no hay suficiente historial de tanques llenos para calcular el rendimiento.");
  } else {
    lines.push("Sin tanque lleno no se calcula rendimiento: sale en la próxima carga con tanque lleno.");
  }
  if (outcome.dropAlert) {
    const { last, averagePrevious } = outcome.dropAlert;
    lines.push(
      "",
      "⚠️ <b>Consumo más alto de lo normal</b>",
      `Este tramo dio ${formatEfficiency(last.kmPerLiter, "l100km")}, contra un promedio de ` +
        `${formatEfficiency(averagePrevious, "l100km")} en los tramos anteriores. Puede valer la pena revisar ` +
        "la presión de los neumáticos, el filtro de aire, el estilo de manejo, o si hubo un viaje fuera de lo común.",
    );
  }
  await show(ctx, lines.join("\n"));
}

export async function handleNaftaCallback(ctx: BotContext, data: string): Promise<void> {
  const [action, id] = data.split(":");
  const state = ctx.session.state ?? "";
  if (!state.startsWith("nafta:")) {
    await expiredDialog(ctx, "/nafta");
    return;
  }

  if (action === "fv") {
    const vehicle = await getVehicle(ctx.db, ctx.actor.familyId, id);
    if (!vehicle) return;
    await askOdometer(ctx, vehicle, { vehicleId: vehicle.id, resetsCalculation: false });
    return;
  }

  const draft = draftOf(ctx);
  const vehicle = draft.vehicleId ? await getVehicle(ctx.db, ctx.actor.familyId, draft.vehicleId) : null;
  if (!vehicle) {
    clearDialog(ctx.session);
    await show(ctx, "Ese vehículo ya no existe. Empezá de nuevo con /nafta.");
    return;
  }

  switch (action) {
    case "fm":
      if (state === "nafta:monto") await askFullTank(ctx, vehicle, { ...draft, totalAmount: null });
      return;

    case "fl":
      if (state === "nafta:lleno") await showConfirmation(ctx, vehicle, { ...draft, isFullTank: id === "1" });
      return;

    case "fk":
      await askOdometer(ctx, vehicle, { ...draft, editing: true });
      return;

    case "fs":
    case "fo":
    case "fr": {
      if (state !== "nafta:confirmar") {
        await expiredDialog(ctx, "/nafta");
        return;
      }
      // Toma atómica: un doble toque de "Guardar" no guarda dos veces
      // (además, unique(vehicle_id, odometer) lo rechazaría).
      const claimed = await claimDialog(ctx.db, ctx.session, "nafta:confirmar");
      if (!claimed) return;
      const current = claimed as unknown as NaftaDraft;
      if (action === "fr") {
        await save(ctx, vehicle, { ...current, resetsCalculation: true }, false);
      } else {
        await save(ctx, vehicle, current, action === "fo");
      }
      return;
    }
  }
}

/** Kilometraje: "45.320" es 45320 (punto de miles); "45320,5" admite decimal. */
export function parseOdometer(text: string): number | null {
  const t = text.trim().replace(/\s+/g, "").replace(/km$/i, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const value = Number(t.replace(",", "."));
    return value > 0 ? value : null;
  }
  return null;
}

/** Litros: "40,5" o "40.5". */
export function parseLiters(text: string): number | null {
  const t = text.trim().replace(/\s+/g, "").replace(/l$/i, "");
  if (!/^\d+([.,]\d{1,3})?$/.test(t)) return null;
  const value = Number(t.replace(",", "."));
  return value > 0 ? value : null;
}

/** Guaraníes enteros: "300000" o "300.000". */
export function parseGuaranies(text: string): number | null {
  const t = text.trim().replace(/\s+/g, "").replace(/^gs\.?/i, "");
  if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(t)) return null;
  const value = Number(t.replace(/\./g, ""));
  return value > 0 ? value : null;
}

export async function handleNaftaText(ctx: BotContext, text: string): Promise<void> {
  const state = ctx.session.state;
  if (state === "nafta:vehiculo") {
    await startNafta(ctx);
    return;
  }
  const draft = draftOf(ctx);
  const vehicle = draft.vehicleId ? await getVehicle(ctx.db, ctx.actor.familyId, draft.vehicleId) : null;
  if (!vehicle) {
    clearDialog(ctx.session);
    await show(ctx, "Ese vehículo ya no existe. Empezá de nuevo con /nafta.");
    return;
  }

  if (state === "nafta:odometro") {
    const odometer = parseOdometer(text);
    if (odometer === null) {
      await askOdometer(ctx, vehicle, draft, "No entendí el kilometraje. Escribí solo el número.");
      return;
    }
    const next = { ...draft, odometer };
    if (draft.editing) await showConfirmation(ctx, vehicle, next);
    else await askLiters(ctx, vehicle, next);
    return;
  }

  if (state === "nafta:litros") {
    const value = parseLiters(text);
    if (value === null) {
      await askLiters(ctx, vehicle, draft, "No entendí los litros. Por ejemplo: 40,5");
      return;
    }
    await askAmount(ctx, vehicle, { ...draft, liters: value });
    return;
  }

  if (state === "nafta:monto") {
    const value = parseGuaranies(text);
    if (value === null) {
      await askAmount(ctx, vehicle, draft, "No entendí el monto. Escribilo en guaraníes, sin decimales.");
      return;
    }
    await askFullTank(ctx, vehicle, { ...draft, totalAmount: value });
    return;
  }

  // Paso de botones: se vuelve a mostrar, abajo.
  if (state === "nafta:lleno") await askFullTank(ctx, vehicle, draft);
  else await showConfirmation(ctx, vehicle, draft);
}
