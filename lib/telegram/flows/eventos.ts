import "server-only";
import { escapeTelegramHtml } from "@/lib/telegram/client";
import { button, CANCEL_BUTTON, chunk, keyboard, shortLabel } from "@/lib/telegram/keyboards";
import { claimDialog, clearDialog, setDialog } from "@/lib/telegram/session";
import { show, showSaved, type BotContext } from "@/lib/telegram/context";
import { expiredDialog } from "@/lib/telegram/router";
import { parseEventText } from "@/lib/events/parse";
import { EDITABLE_EVENT_CATEGORIES, EVENT_CATEGORIES, REMINDER_PRESETS } from "@/lib/events/constants";
import {
  addDaysToDateOnly,
  dateOnlyToFamilyMidnightUtc,
  dateTimeToFamilyUtc,
  formatDate,
  todayInFamilyTimezone,
} from "@/lib/dates";
import { createEvent, listActiveMembers } from "@/lib/services/eventos";
import type { EventCategory } from "@/lib/supabase/types";

// Alta de un evento por Telegram (`/evento`).
//
// Todo en un mensaje: "Dentista jueves 15:30". El texto lo interpreta
// `parseEventText` (lib/events/parse.ts, función pura); el guardado pasa
// por `createEvent` de lib/services/eventos.ts, el mismo servicio que el
// formulario de la app. Si el texto no dice el día, se pregunta; si no
// dice la hora, es de todo el día (se ve en la confirmación).
//
// Después: categoría (botones) y participantes (para marcar; ninguno es
// "toda la familia"). Aviso por Telegram 1 día antes por defecto, que se
// cambia desde la confirmación. Solo eventos únicos: la repetición se
// configura en la app.
//
// Callbacks (un identificador como máximo; el borrador vive en la sesión):
//   ed:<n>         día: hoy + n días        ek:<categoría>  categoría
//   ep:<memberId>  marcar participante      ev              ir a la confirmación
//   ex             menú "Cambiar"           ew              volver a escribir día y hora
//   ea             elegir aviso             er:<min|no>     aviso elegido
//   es             guardar

type EventoDraft = {
  title: string;
  date: string | null;
  time: string | null;
  endTime: string | null;
  category: Exclude<EventCategory, "cumpleanos">;
  participantIds: string[];
  /** Minutos antes del evento, o null sin aviso. */
  reminder: number | null;
  /** Se está cambiando un campo desde la confirmación: al elegir, vuelve ahí. */
  editing?: boolean;
};

/** Pedido del usuario: el aviso por Telegram arranca 1 día antes. */
const DEFAULT_REMINDER_MINUTES = 1440;

const EXAMPLES = "<i>Dentista jueves 15:30</i>, <i>Cumple de Ana 20/10</i> o <i>Reunión de padres mañana a las 19</i>";

function draftOf(ctx: BotContext): EventoDraft {
  return ctx.session.context as unknown as EventoDraft;
}

function saveDraft(ctx: BotContext, state: string, draft: EventoDraft) {
  setDialog(ctx.session, state, draft as unknown as Record<string, unknown>);
}

function dayLabel(date: string): string {
  const today = todayInFamilyTimezone();
  const label = formatDate(date, "EEEE d 'de' MMMM");
  if (date === today) return `hoy, ${label}`;
  if (date === addDaysToDateOnly(today, 1)) return `mañana, ${label}`;
  return label;
}

function whenLabel(draft: EventoDraft): string {
  const day = draft.date ? dayLabel(draft.date) : "sin día";
  if (!draft.time) return `${day} · todo el día`;
  return `${day} · ${draft.time}${draft.endTime ? ` a ${draft.endTime}` : ""}`;
}

function reminderLabel(minutes: number | null): string {
  if (minutes === null) return "sin aviso";
  return REMINDER_PRESETS.find((p) => p.minutes === minutes)?.label.toLowerCase() ?? `${minutes} min antes`;
}

export async function startEvento(ctx: BotContext): Promise<void> {
  setDialog(ctx.session, "evento:texto", {});
  await show(
    ctx,
    `📅 <b>Nuevo evento</b>\n\nEscribilo en un mensaje, con el día y la hora. Por ejemplo: ${EXAMPLES}.\n\nSin hora queda de todo el día.`,
    keyboard([[CANCEL_BUTTON]]),
  );
}

async function askDate(ctx: BotContext, draft: EventoDraft, error?: string) {
  saveDraft(ctx, "evento:fecha", draft);
  await show(
    ctx,
    `📅 <b>${escapeTelegramHtml(draft.title)}</b>\n\n` +
      (error ? `⚠️ ${escapeTelegramHtml(error)}\n\n` : "") +
      "¿Qué día? Tocá una opción o escribila (<i>15/10</i>, <i>viernes</i>, <i>20 de noviembre</i>). Podés sumar la hora.",
    keyboard([
      [button("Hoy", "ed:0"), button("Mañana", "ed:1"), button("Pasado mañana", "ed:2")],
      [CANCEL_BUTTON],
    ]),
  );
}

async function askCategory(ctx: BotContext, draft: EventoDraft) {
  saveDraft(ctx, "evento:categoria", draft);
  // "Familiar" primero: es la que el formulario de la app trae por defecto.
  const ordered = [...EDITABLE_EVENT_CATEGORIES].sort(
    (a, b) => Number(b === "familiar") - Number(a === "familiar"),
  );
  await show(
    ctx,
    `📅 <b>${escapeTelegramHtml(draft.title)}</b>\n${whenLabel(draft)}\n\n¿Categoría?`,
    keyboard([
      ...chunk(
        ordered.map((c) => button(`${c === draft.category ? "● " : ""}${EVENT_CATEGORIES[c].label}`, `ek:${c}`)),
        2,
      ),
      [CANCEL_BUTTON],
    ]),
  );
}

async function askParticipants(ctx: BotContext, draft: EventoDraft) {
  const members = await listActiveMembers(ctx.db, ctx.actor.familyId);
  saveDraft(ctx, "evento:participantes", draft);
  const selected = new Set(draft.participantIds);
  await show(
    ctx,
    `📅 <b>${escapeTelegramHtml(draft.title)}</b>\n${whenLabel(draft)}\n\n¿Quiénes van? Si no marcás a nadie, es de toda la familia.`,
    keyboard([
      ...chunk(
        members.map((m) => button(`${selected.has(m.id) ? "✅" : "⬜"} ${shortLabel(m.display_name, 20)}`, `ep:${m.id}`)),
        2,
      ),
      [button(selected.size === 0 ? "Toda la familia" : "Listo", "ev")],
    ]),
  );
}

async function showConfirmation(ctx: BotContext, draft: EventoDraft, notice?: string) {
  draft = { ...draft, editing: false };
  if (!draft.date) {
    await askDate(ctx, draft);
    return;
  }
  const members = await listActiveMembers(ctx.db, ctx.actor.familyId);
  const names = draft.participantIds
    .map((id) => members.find((m) => m.id === id)?.display_name)
    .filter(Boolean)
    .join(", ");

  const startsAt = draft.time ? dateTimeToFamilyUtc(draft.date, draft.time) : dateOnlyToFamilyMidnightUtc(draft.date);
  const pastWarning =
    (draft.time ? startsAt.getTime() < Date.now() : draft.date < todayInFamilyTimezone())
      ? "\n⚠️ Esa fecha ya pasó."
      : "";

  saveDraft(ctx, "evento:confirmar", draft);
  await show(
    ctx,
    (notice ? `⚠️ ${escapeTelegramHtml(notice)}\n\n` : "") +
      [
        `📅 <b>${escapeTelegramHtml(draft.title)}</b>`,
        "",
        capitalize(whenLabel(draft)) + pastWarning,
        `Categoría: ${EVENT_CATEGORIES[draft.category].label}`,
        `Quiénes: ${escapeTelegramHtml(names || "toda la familia")}`,
        `Aviso por Telegram: ${reminderLabel(draft.reminder)}`,
      ].join("\n"),
    keyboard([[button("✅ Guardar", "es"), button("✏️ Cambiar", "ex")], [CANCEL_BUTTON]]),
  );
}

async function showChangeMenu(ctx: BotContext, draft: EventoDraft) {
  saveDraft(ctx, "evento:cambiar", { ...draft, editing: true });
  await show(
    ctx,
    "¿Qué querés cambiar?",
    keyboard([
      [button("🕐 Día y hora", "ew"), button("⏰ Aviso", "ea")],
      [button("🏷️ Categoría", "ek:-"), button("👥 Quiénes", "ep:-")],
      [button("↩️ Volver", "ev")],
    ]),
  );
}

export async function handleEventoCallback(ctx: BotContext, data: string): Promise<void> {
  const [action, id] = data.split(":");
  const state = ctx.session.state ?? "";
  if (!state.startsWith("evento:") || state === "evento:texto") {
    if (state === "evento:texto") return; // solo hay "Cancelar", que atiende el router
    await expiredDialog(ctx, "/evento");
    return;
  }
  const draft = draftOf(ctx);

  switch (action) {
    case "ed": {
      const days = Number(id);
      if (!(days >= 0 && days <= 2)) return;
      await askCategory(ctx, { ...draft, date: addDaysToDateOnly(todayInFamilyTimezone(), days) });
      return;
    }

    case "ek":
      if (id === "-") await askCategory(ctx, draft);
      else if ((EDITABLE_EVENT_CATEGORIES as string[]).includes(id)) {
        const next = { ...draft, category: id as EventoDraft["category"] };
        // En el alta, después de la categoría vienen los participantes;
        // cambiándola desde la confirmación, se vuelve directo.
        if (draft.editing) await showConfirmation(ctx, next);
        else await askParticipants(ctx, next);
      }
      return;

    case "ep": {
      if (id === "-") {
        await askParticipants(ctx, draft);
        return;
      }
      const selected = new Set(draft.participantIds);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      await askParticipants(ctx, { ...draft, participantIds: [...selected] });
      return;
    }

    case "ev":
      await showConfirmation(ctx, draft);
      return;

    case "ex":
      await showChangeMenu(ctx, draft);
      return;

    case "ew":
      saveDraft(ctx, "evento:rehora", draft);
      await show(
        ctx,
        `📅 <b>${escapeTelegramHtml(draft.title)}</b>\n\nEscribí el nuevo día y hora (<i>viernes 18:00</i>, <i>20/10</i>, <i>mañana a las 9</i>). Sin hora queda de todo el día.`,
        keyboard([[button("↩️ Volver", "ev")]]),
      );
      return;

    case "ea":
      saveDraft(ctx, "evento:aviso", draft);
      await show(
        ctx,
        "¿Cuándo te aviso por Telegram?",
        keyboard([
          ...chunk(
            REMINDER_PRESETS.map((p) => button(`${p.minutes === draft.reminder ? "● " : ""}${p.label}`, `er:${p.minutes}`)),
            2,
          ),
          [button(`${draft.reminder === null ? "● " : ""}Sin aviso`, "er:no")],
        ]),
      );
      return;

    case "er": {
      if (id === "no") {
        await showConfirmation(ctx, { ...draft, reminder: null });
        return;
      }
      const minutes = Number(id);
      if (REMINDER_PRESETS.some((p) => p.minutes === minutes)) await showConfirmation(ctx, { ...draft, reminder: minutes });
      return;
    }

    case "es":
      await saveEvento(ctx);
      return;
  }
}

async function saveEvento(ctx: BotContext) {
  if (ctx.session.state !== "evento:confirmar") {
    await expiredDialog(ctx, "/evento");
    return;
  }
  // Toma atómica: un doble toque de "Guardar" no crea dos eventos.
  const claimed = await claimDialog(ctx.db, ctx.session, "evento:confirmar");
  if (!claimed) return;
  const draft = claimed as unknown as EventoDraft;
  if (!draft.date || !draft.title) {
    await expiredDialog(ctx, "/evento");
    return;
  }

  const result = await createEvent(ctx.db, ctx.actor, {
    title: draft.title,
    description: null,
    category: draft.category,
    startsAt: draft.time ? dateTimeToFamilyUtc(draft.date, draft.time) : dateOnlyToFamilyMidnightUtc(draft.date),
    endsAt: draft.time && draft.endTime ? dateTimeToFamilyUtc(draft.date, draft.endTime) : null,
    allDay: !draft.time,
    location: null,
    recurrence: null,
    recurrenceUntil: null,
    participantIds: draft.participantIds,
    // Igual que el formulario: cada aviso elegido genera el recordatorio
    // del calendario y, con Telegram, el del bot.
    reminderMinutes: draft.reminder === null ? [] : [draft.reminder],
    telegram: draft.reminder !== null,
  });

  if (!result.ok) {
    await showConfirmation(ctx, draft, result.error);
    return;
  }

  await showSaved(
    ctx,
    `✅ Agendado: <b>${escapeTelegramHtml(draft.title)}</b>\n${capitalize(whenLabel(draft))}` +
      (draft.reminder !== null ? `\nTe aviso ${reminderLabel(draft.reminder)}.` : ""),
    keyboard([[button("📅 Ver agenda del día", `ag:${draft.date}`), button("➕ Otro evento", "m:e")]]),
  );
}

function newDraft(parsed: ReturnType<typeof parseEventText>): EventoDraft {
  return {
    title: parsed.title,
    date: parsed.date,
    time: parsed.time,
    endTime: parsed.endTime,
    category: "familiar",
    participantIds: [],
    reminder: DEFAULT_REMINDER_MINUTES,
  };
}

export async function handleEventoText(ctx: BotContext, text: string): Promise<void> {
  const state = ctx.session.state;
  const today = todayInFamilyTimezone();

  if (state === "evento:texto") {
    const parsed = parseEventText(text, today);
    if (!parsed.title) {
      await show(ctx, `No encontré el nombre del evento. Probá de nuevo, por ejemplo: ${EXAMPLES}.`, keyboard([[CANCEL_BUTTON]]));
      return;
    }
    const draft = newDraft(parsed);
    if (!draft.date) await askDate(ctx, draft);
    else await askCategory(ctx, draft);
    return;
  }

  const draft = draftOf(ctx);

  if (state === "evento:fecha" || state === "evento:rehora") {
    const parsed = parseEventText(text, today);
    if (!parsed.date) {
      if (state === "evento:fecha") await askDate(ctx, draft, "No entendí el día.");
      else await show(ctx, "No entendí el día. Escribilo así: <i>viernes 18:00</i> o <i>20/10</i>.", keyboard([[button("↩️ Volver", "ev")]]));
      return;
    }
    const next: EventoDraft = {
      ...draft,
      date: parsed.date,
      // En "evento:fecha" la hora pudo venir en el primer mensaje; si este
      // trae otra, manda la nueva. Al reescribir día y hora, se reemplazan.
      time: parsed.time ?? (state === "evento:fecha" ? draft.time : null),
      endTime: parsed.time ? parsed.endTime : state === "evento:fecha" ? draft.endTime : null,
    };
    if (state === "evento:fecha") await askCategory(ctx, next);
    else await showConfirmation(ctx, next);
    return;
  }

  // Paso de botones: se vuelve a mostrar, abajo.
  if (state === "evento:categoria") await askCategory(ctx, draft);
  else if (state === "evento:participantes") await askParticipants(ctx, draft);
  else if (!draft.title) {
    clearDialog(ctx.session);
    await startEvento(ctx);
  } else await showConfirmation(ctx, draft, "Elegí una de las opciones con los botones.");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
