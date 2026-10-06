import "server-only";
import { escapeTelegramHtml, editMessageReplyMarkup, type InlineKeyboardMarkup } from "@/lib/telegram/client";
import { button, keyboard, NOOP, shortLabel } from "@/lib/telegram/keyboards";
import { sendLive, show, type BotContext } from "@/lib/telegram/context";
import type { TelegramMessage } from "@/lib/telegram/router";
import { startCompras } from "@/lib/telegram/flows/compras";
import { buildDisplayEvents, type DisplayEvent } from "@/lib/events/view-model";
import { describeBalance } from "@/lib/expenses/constants";
import { FEATURES } from "@/lib/features";
import { formatGuaranies } from "@/lib/format";
import {
  addDaysToDateOnly,
  dateOnlyInFamilyTimezone,
  dateOnlyToFamilyMidnightUtc,
  formatDate,
  formatTime,
  todayInFamilyTimezone,
} from "@/lib/dates";
import { daysOverdue } from "@/lib/tasks/schedule";
import { listActiveMembers, listEventsWithDetails } from "@/lib/services/eventos";
import { completeTaskInstance, getTaskInstance, listPendingInstancesWithDetails } from "@/lib/services/tareas";
import { getOpenList, listItems } from "@/lib/services/compras";
import { listGroupSummaries } from "@/lib/services/gastos";
import type { FamilyMember } from "@/lib/supabase/types";

// `/hoy`: resumen de solo lectura, sin estado. Es el comando que más se
// va a usar, así que todo se pide en paralelo en una sola tanda.
//
// También atiende los botones de los avisos de los crons:
//   th:<instanceId>  "Marcar hecha" en el aviso diario de tareas
//   ag:<yyyy-MM-dd>  "Ver agenda del día" en el recordatorio de un evento
//   hl               abrir la lista de compras desde /hoy

function eventLine(event: DisplayEvent, today: string, membersById: Map<string, FamilyMember>): string {
  const day = dateOnlyInFamilyTimezone(event.starts_at);
  const dayLabel = day <= today ? "Hoy" : day === addDaysToDateOnly(today, 1) ? "Mañana" : formatDate(day, "EEE d");
  const time = event.all_day ? "todo el día" : formatTime(event.starts_at);
  const who = event.participant_ids
    .map((id) => membersById.get(id)?.display_name)
    .filter(Boolean)
    .join(", ");
  return `• ${dayLabel}, ${time} — ${escapeTelegramHtml(event.title)}${who ? ` <i>(${escapeTelegramHtml(who)})</i>` : ""}`;
}

async function loadOpenListProgress(ctx: BotContext) {
  const list = await getOpenList(ctx.db, ctx.actor.familyId);
  if (!list) return null;
  const items = await listItems(ctx.db, ctx.actor.familyId, list.id);
  return { list, total: items.length, pending: items.filter((i) => !i.is_checked).length };
}

export async function sendHoy(ctx: BotContext): Promise<void> {
  const today = todayInFamilyTimezone();
  // Las tareas se muestran si el módulo está a la vista o si avisa: con
  // `tareasAvisos` prendido el cron las genera y las avisa, así que tiene
  // sentido verlas acá aunque no estén en el inicio de la app.
  const showTasks = FEATURES.tareas || FEATURES.tareasAvisos;

  const [events, members, openList, tasks, groups] = await Promise.all([
    listEventsWithDetails(ctx.db, ctx.actor.familyId),
    listActiveMembers(ctx.db, ctx.actor.familyId),
    loadOpenListProgress(ctx),
    showTasks ? listPendingInstancesWithDetails(ctx.db, ctx.actor.familyId) : Promise.resolve([]),
    listGroupSummaries(ctx.db, ctx.actor.familyId, ctx.actor.memberId),
  ]);

  const membersById = new Map(members.map((m) => [m.id, m]));
  const upcoming = buildDisplayEvents(
    events,
    members,
    dateOnlyToFamilyMidnightUtc(today),
    dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, 2)),
  );
  const overdue = tasks.filter((t) => t.due_date < today);
  const myGroups = groups.filter((g) => g.group.status === "abierto" && g.myBalance !== null);

  const parts: string[] = [`📅 <b>${escapeTelegramHtml(capitalize(formatDate(today, "EEEE d 'de' MMMM")))}</b>`];

  parts.push("", "<b>Eventos de hoy y mañana</b>");
  parts.push(...(upcoming.length > 0 ? upcoming.map((e) => eventLine(e, today, membersById)) : ["Nada agendado."]));

  if (overdue.length > 0) {
    parts.push("", "<b>Tareas vencidas</b>");
    parts.push(
      ...overdue.map((t) => {
        const days = daysOverdue(t.due_date, today);
        return `• ${escapeTelegramHtml(t.definition.title)} — hace ${days} día${days === 1 ? "" : "s"}`;
      }),
    );
  }

  parts.push("", "<b>Compras</b>");
  if (openList) {
    const name = escapeTelegramHtml(openList.list.name ?? "Lista de compras");
    parts.push(
      openList.pending === 0
        ? `🛒 ${name}: está todo (${openList.total} productos).`
        : `🛒 ${name}: faltan ${openList.pending} de ${openList.total}.`,
    );
  } else {
    parts.push("No hay lista abierta.");
  }

  if (myGroups.length > 0) {
    parts.push("", "<b>Gastos compartidos</b>");
    parts.push(
      ...myGroups.map((g) =>
        g.isConsistent
          ? `• ${escapeTelegramHtml(g.group.name)}: ${describeBalance(g.myBalance ?? 0, formatGuaranies)}`
          : `• ${escapeTelegramHtml(g.group.name)}: los números no cierran, revisalo en la app.`,
      ),
    );
  }

  await show(ctx, parts.join("\n"), openList ? keyboard([[button("🛒 Ver lista", "hl")]]) : undefined);
}

/** Agenda de un día puntual (botón de los recordatorios de eventos). */
async function sendDayAgenda(ctx: BotContext, day: string): Promise<void> {
  const [events, members] = await Promise.all([
    listEventsWithDetails(ctx.db, ctx.actor.familyId),
    listActiveMembers(ctx.db, ctx.actor.familyId),
  ]);
  const membersById = new Map(members.map((m) => [m.id, m]));
  const dayEvents = buildDisplayEvents(
    events,
    members,
    dateOnlyToFamilyMidnightUtc(day),
    dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(day, 1)),
  );

  const lines = [`📅 <b>Agenda del ${escapeTelegramHtml(formatDate(day, "EEEE d 'de' MMMM"))}</b>`, ""];
  if (dayEvents.length === 0) lines.push("Nada agendado.");
  for (const event of dayEvents) {
    const who = event.participant_ids
      .map((id) => membersById.get(id)?.display_name)
      .filter(Boolean)
      .join(", ");
    lines.push(
      `• ${event.all_day ? "Todo el día" : formatTime(event.starts_at)} — ${escapeTelegramHtml(event.title)}` +
        (who ? ` <i>(${escapeTelegramHtml(who)})</i>` : "") +
        (event.location ? `\n   📍 ${escapeTelegramHtml(event.location)}` : ""),
    );
  }
  await sendLive(ctx, lines.join("\n"));
}

export async function handleHoyCallback(ctx: BotContext, data: string, message: TelegramMessage | undefined) {
  const [action, id] = data.split(":");

  if (action === "hl") {
    // La lista va en un mensaje aparte: el resumen queda como estaba.
    await startCompras({ ...ctx, trigger: { kind: "text" } });
    return;
  }

  if (action === "ag") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id ?? "")) return;
    await sendDayAgenda(ctx, id);
    return;
  }

  if (action === "th") {
    await markTaskDone(ctx, data, id, message);
  }
}

/**
 * "Marcar hecha" desde el aviso diario. Completa la tarea con el mismo
 * servicio que la pantalla `/tareas` (recalcula el próximo vencimiento
 * con las mismas reglas) y edita el mensaje: el botón de esa tarea pasa a
 * "hecha" y deja de ser tocable. Si ya estaba hecha (la marcó otro
 * miembro, o es un doble toque), no la vuelve a completar — completar dos
 * veces correría el vencimiento dos veces.
 */
async function markTaskDone(ctx: BotContext, data: string, instanceId: string, message: TelegramMessage | undefined) {
  const instance = await getTaskInstance(ctx.db, ctx.actor.familyId, instanceId);
  let label: string;
  if (!instance) {
    label = "Tarea no encontrada";
  } else if (instance.status !== "pendiente") {
    label = "Ya estaba hecha";
  } else {
    const result = await completeTaskInstance(ctx.db, ctx.actor, instanceId);
    label = result.ok ? `✅ Hecha: ${shortLabel(result.definition.title, 24)}` : "No se pudo completar";
  }

  if (!message?.reply_markup) return;
  const markup: InlineKeyboardMarkup = {
    inline_keyboard: message.reply_markup.inline_keyboard.map((row) =>
      row.map((b) => (b.callback_data === data ? button(label, NOOP) : b)),
    ),
  };
  await editMessageReplyMarkup(ctx.chatId, message.message_id, markup);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
