import "server-only";
import { escapeTelegramHtml } from "@/lib/telegram/client";
import { button, CANCEL_BUTTON, chunk, keyboard, shortLabel } from "@/lib/telegram/keyboards";
import { claimDialog, clearDialog, setDialog } from "@/lib/telegram/session";
import { show, type BotContext } from "@/lib/telegram/context";
import { expiredDialog } from "@/lib/telegram/router";
import { addDaysToDateOnly, formatDate, todayInFamilyTimezone } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import {
  CURRENCIES,
  currencySymbol,
  describeBalance,
  formatOriginalAmount,
  PAYMENT_METHODS,
} from "@/lib/expenses/constants";
import {
  getGroup,
  lastPaymentMethod,
  listExpenseCategories,
  listGroupParticipants,
  listGroupSummaries,
  listOpenGroups,
  persistExpense,
  prepareExpense,
  type PreparedExpense,
} from "@/lib/services/gastos";
import type { ExpenseGroup, ExpensePaymentMethod, GroupParticipant } from "@/lib/supabase/types";

// Carga de un gasto por Telegram (`/gasto`). Pensado para usarse parado
// en un restaurante: el camino rápido es dos textos y dos toques
// (importe con descripción, categoría, Guardar). Todo lo demás tiene un
// valor por defecto que se puede cambiar desde "Cambiar":
//   - paga quien escribe (si participa del grupo),
//   - partes iguales entre todos los participantes activos,
//   - fecha de hoy,
//   - método de pago: el del último gasto cargado en ese grupo.
//
// La división NO se calcula acá: la pantalla de confirmación y el
// guardado pasan por `prepareExpense` (lib/services/gastos.ts), la misma
// función que usa el formulario de la app — enteros de guaraníes, resto
// determinístico, invariante de suma cero. Divisiones por pesos o
// importes exactos no se hacen por chat: se editan en la app.
//
// Callbacks (un identificador como máximo; el borrador vive en la sesión):
//   gg:<groupId>  elegir grupo          gm:<MONEDA>  elegir moneda
//   gc:<catId|->  elegir categoría      gs           guardar
//   gx            menú "Cambiar"        gv           volver a la confirmación
//   ge:<campo>    editar un campo       gp:<partId>  quién pagó
//   gw:<método>   método de pago        gt:<partId>  sumar/sacar de la división
//   gd:<n>        fecha (hace n días)

type GastoDraft = {
  groupId: string;
  currency: string;
  rate: string;
  amount?: string;
  description?: string;
  categoryId?: string | null;
  paidBy: string | null;
  paymentMethod: ExpensePaymentMethod;
  splitIds: string[];
  spentOn: string;
  /** Se está corrigiendo un campo desde "Cambiar": al terminar vuelve a la confirmación. */
  editing?: boolean;
};

const MAX_DESCRIPTION = 120;

function draftOf(ctx: BotContext): GastoDraft {
  return ctx.session.context as unknown as GastoDraft;
}

function saveDraft(ctx: BotContext, state: string, draft: GastoDraft) {
  setDialog(ctx.session, state, draft as unknown as Record<string, unknown>);
}

function header(group: ExpenseGroup): string {
  return `💸 <b>${escapeTelegramHtml(group.name)}</b>`;
}

export async function startGasto(ctx: BotContext): Promise<void> {
  const groups = await listOpenGroups(ctx.db, ctx.actor.familyId);
  if (groups.length === 0) {
    await show(ctx, "No hay grupos de gastos abiertos. Creá uno desde la app, en <b>Gastos</b>.");
    return;
  }
  if (groups.length === 1) {
    await selectGroup(ctx, groups[0].id);
    return;
  }
  setDialog(ctx.session, "gasto:grupo", {});
  await show(
    ctx,
    "💸 ¿En qué grupo es el gasto?",
    keyboard([...groups.slice(0, 10).map((g) => [button(shortLabel(g.name), `gg:${g.id}`)]), [CANCEL_BUTTON]]),
  );
}

async function selectGroup(ctx: BotContext, groupId: string): Promise<void> {
  const [group, participants, method] = await Promise.all([
    getGroup(ctx.db, ctx.actor.familyId, groupId),
    listGroupParticipants(ctx.db, ctx.actor.familyId, groupId),
    lastPaymentMethod(ctx.db, ctx.actor.familyId, groupId),
  ]);
  if (!group) {
    await show(ctx, "No encontré ese grupo.");
    return;
  }
  const active = participants.filter((p) => p.is_active);
  const me = active.find((p) => p.member_id === ctx.actor.memberId);

  const draft: GastoDraft = {
    groupId: group.id,
    currency: "PYG",
    rate: "1",
    paidBy: me?.id ?? null,
    paymentMethod: method ?? "efectivo",
    splitIds: active.map((p) => p.id),
    spentOn: todayInFamilyTimezone(),
  };

  if (Object.keys(group.default_rates ?? {}).length > 0) {
    await askCurrency(ctx, group, draft);
  } else {
    await askAmount(ctx, group, draft);
  }
}

/** Solo las monedas con cotización por defecto en el grupo (más guaraníes). */
async function askCurrency(ctx: BotContext, group: ExpenseGroup, draft: GastoDraft) {
  const rates = group.default_rates ?? {};
  const options = CURRENCIES.filter((c) => c.code === "PYG" || rates[c.code]);
  saveDraft(ctx, "gasto:moneda", draft);
  await show(
    ctx,
    `${header(group)}\n¿En qué moneda?`,
    keyboard([
      ...chunk(
        options.map((c) =>
          button(
            c.code === "PYG" ? "Gs" : `${c.symbol} (× ${rates[c.code].toLocaleString("es-PY")})`,
            `gm:${c.code}`,
          ),
        ),
        2,
      ),
      [CANCEL_BUTTON],
    ]),
  );
}

async function askAmount(ctx: BotContext, group: ExpenseGroup, draft: GastoDraft, error?: string) {
  saveDraft(ctx, "gasto:monto", draft);
  const label = draft.currency === "PYG" ? "guaraníes" : CURRENCIES.find((c) => c.code === draft.currency)?.label;
  const example = draft.currency === "PYG" ? "45000 cena" : "120,50 cena";
  await show(
    ctx,
    `${header(group)}\n` +
      (error ? `⚠️ ${escapeTelegramHtml(error)}\n\n` : "") +
      `¿Cuánto fue? Escribí el importe en ${escapeTelegramHtml(label ?? draft.currency)}` +
      (draft.editing ? "." : `. Podés sumar la descripción: <i>${example}</i>`),
    keyboard([[draft.editing ? button("↩️ Volver", "gv") : CANCEL_BUTTON]]),
  );
}

async function askDescription(ctx: BotContext, group: ExpenseGroup, draft: GastoDraft) {
  saveDraft(ctx, "gasto:descripcion", draft);
  await show(
    ctx,
    `${header(group)}\n${formatOriginalAmount(Number(draft.amount), draft.currency)}\n\n¿En qué fue? (por ejemplo <i>cena</i>, <i>peaje</i>)`,
    keyboard([[draft.editing ? button("↩️ Volver", "gv") : CANCEL_BUTTON]]),
  );
}

async function askCategory(ctx: BotContext, group: ExpenseGroup, draft: GastoDraft) {
  const categories = (await listExpenseCategories(ctx.db, ctx.actor.familyId)).filter((c) => c.is_active);
  if (categories.length === 0) {
    await showConfirmation(ctx, { ...draft, categoryId: null, editing: false });
    return;
  }
  saveDraft(ctx, "gasto:categoria", draft);
  await show(
    ctx,
    `${header(group)}\n${formatOriginalAmount(Number(draft.amount), draft.currency)} · ${escapeTelegramHtml(draft.description ?? "")}\n\n¿Categoría?`,
    keyboard([
      ...chunk(
        categories.map((c) => button(shortLabel(c.name, 20), `gc:${c.id}`)),
        2,
      ),
      [button("Sin categoría", "gc:-")],
      [CANCEL_BUTTON],
    ]),
  );
}

function dateLabel(spentOn: string): string {
  const today = todayInFamilyTimezone();
  if (spentOn === today) return "hoy";
  if (spentOn === addDaysToDateOnly(today, -1)) return "ayer";
  return formatDate(spentOn);
}

function renderSummary(
  draft: GastoDraft,
  prepared: PreparedExpense,
  categoryName: string | null,
): string {
  const byId = new Map(prepared.participants.map((p) => [p.id, p]));
  const payer = draft.paidBy ? byId.get(draft.paidBy) : null;
  const amountLine =
    draft.currency === "PYG"
      ? `<b>${formatGuaranies(prepared.amountPyg)}</b>`
      : `${formatOriginalAmount(Number(prepared.amount), draft.currency)} × ${Number(prepared.rate).toLocaleString("es-PY")} = <b>${formatGuaranies(prepared.amountPyg)}</b>`;

  return [
    `${header(prepared.group)}`,
    "",
    `<b>${escapeTelegramHtml(draft.description ?? "")}</b>${categoryName ? ` · ${escapeTelegramHtml(categoryName)}` : ""}`,
    amountLine,
    `Pagó ${escapeTelegramHtml(payer?.display_name ?? "?")} · ${PAYMENT_METHODS[draft.paymentMethod].label} · ${dateLabel(draft.spentOn)}`,
    "",
    `Partes iguales entre ${prepared.shares.length}:`,
    ...prepared.shares.map(
      (s) => `• ${escapeTelegramHtml(byId.get(s.participantId)?.display_name ?? "?")} — ${formatGuaranies(s.sharePyg)}`,
    ),
  ].join("\n");
}

function prepare(ctx: BotContext, draft: GastoDraft) {
  return prepareExpense(ctx.db, ctx.actor.familyId, {
    groupId: draft.groupId,
    amount: draft.amount ?? "",
    currency: draft.currency,
    exchangeRate: draft.rate,
    paidBy: draft.paidBy ?? "",
    split: { method: "iguales", participantIds: draft.splitIds },
  });
}

async function showConfirmation(ctx: BotContext, draft: GastoDraft, notice?: string): Promise<void> {
  draft = { ...draft, editing: false };
  if (!draft.paidBy) {
    // Quien escribe no participa del grupo: no hay un default sensato.
    await askPayer(ctx, draft, "¿Quién pagó?");
    return;
  }

  const [prepared, categories] = await Promise.all([
    prepare(ctx, draft),
    listExpenseCategories(ctx.db, ctx.actor.familyId),
  ]);
  saveDraft(ctx, "gasto:confirmar", draft);

  if (!prepared.ok) {
    await show(
      ctx,
      `⚠️ ${escapeTelegramHtml(prepared.error)}`,
      keyboard([[button("✏️ Cambiar", "gx")], [CANCEL_BUTTON]]),
    );
    return;
  }

  const categoryName = categories.find((c) => c.id === draft.categoryId)?.name ?? null;
  await show(
    ctx,
    (notice ? `⚠️ ${escapeTelegramHtml(notice)}\n\n` : "") + renderSummary(draft, prepared, categoryName),
    keyboard([[button("✅ Guardar", "gs"), button("✏️ Cambiar", "gx")], [CANCEL_BUTTON]]),
  );
}

async function askPayer(ctx: BotContext, draft: GastoDraft, title = "¿Quién pagó?") {
  const participants = (await listGroupParticipants(ctx.db, ctx.actor.familyId, draft.groupId)).filter((p) => p.is_active);
  saveDraft(ctx, "gasto:pagador", draft);
  await show(
    ctx,
    title,
    keyboard([
      ...chunk(
        participants.map((p) => button(`${p.id === draft.paidBy ? "● " : ""}${shortLabel(p.display_name, 20)}`, `gp:${p.id}`)),
        2,
      ),
      [CANCEL_BUTTON],
    ]),
  );
}

async function askSplit(ctx: BotContext, draft: GastoDraft, participants?: GroupParticipant[]) {
  const active = (participants ?? (await listGroupParticipants(ctx.db, ctx.actor.familyId, draft.groupId))).filter(
    (p) => p.is_active,
  );
  saveDraft(ctx, "gasto:division", draft);
  const selected = new Set(draft.splitIds);
  await show(
    ctx,
    "¿Entre quiénes se divide? (partes iguales)\nPara dividir por pesos o importes exactos, editalo después en la app.",
    keyboard([
      ...chunk(
        active.map((p) => button(`${selected.has(p.id) ? "✅" : "⬜"} ${shortLabel(p.display_name, 20)}`, `gt:${p.id}`)),
        2,
      ),
      [button("Listo", "gv")],
    ]),
  );
}

async function showChangeMenu(ctx: BotContext, draft: GastoDraft) {
  saveDraft(ctx, "gasto:cambiar", draft);
  await show(
    ctx,
    "¿Qué querés cambiar?",
    keyboard([
      [button("💰 Monto", "ge:a"), button("📝 Descripción", "ge:d")],
      [button("🏷️ Categoría", "ge:c"), button("👤 Quién pagó", "ge:p")],
      [button("💳 Método de pago", "ge:m"), button("👥 Entre quiénes", "ge:s")],
      [button("📅 Fecha", "ge:f"), button("↩️ Volver", "gv")],
    ]),
  );
}

export async function handleGastoCallback(ctx: BotContext, data: string): Promise<void> {
  const [action, id] = data.split(":");
  const state = ctx.session.state ?? "";

  if (!state.startsWith("gasto:")) {
    await expiredDialog(ctx, "/gasto");
    return;
  }

  if (action === "gg") {
    await selectGroup(ctx, id);
    return;
  }

  const draft = draftOf(ctx);
  const group = await getGroup(ctx.db, ctx.actor.familyId, draft.groupId);
  if (!group) {
    clearDialog(ctx.session);
    await show(ctx, "Ese grupo ya no existe.");
    return;
  }

  switch (action) {
    case "gm": {
      const rate = id === "PYG" ? 1 : group.default_rates?.[id];
      if (!rate) return;
      await askAmount(ctx, group, { ...draft, currency: id, rate: String(rate) });
      return;
    }

    case "gc": {
      await showConfirmation(ctx, { ...draft, categoryId: id === "-" ? null : id });
      return;
    }

    case "gv":
      await showConfirmation(ctx, draft);
      return;

    case "gx":
      await showChangeMenu(ctx, draft);
      return;

    case "ge": {
      const editing = { ...draft, editing: true };
      if (id === "a") {
        if (Object.keys(group.default_rates ?? {}).length > 0) await askCurrency(ctx, group, editing);
        else await askAmount(ctx, group, editing);
      } else if (id === "d") await askDescription(ctx, group, editing);
      else if (id === "c") await askCategory(ctx, group, editing);
      else if (id === "p") await askPayer(ctx, draft);
      else if (id === "s") await askSplit(ctx, draft);
      else if (id === "m") {
        saveDraft(ctx, "gasto:metodo", draft);
        await show(
          ctx,
          "¿Cómo se pagó?",
          keyboard(
            chunk(
              (Object.keys(PAYMENT_METHODS) as ExpensePaymentMethod[]).map((m) =>
                button(`${m === draft.paymentMethod ? "● " : ""}${PAYMENT_METHODS[m].label}`, `gw:${m}`),
              ),
              2,
            ),
          ),
        );
      } else if (id === "f") {
        saveDraft(ctx, "gasto:fecha", draft);
        await show(
          ctx,
          "¿Cuándo fue?",
          keyboard([[button("Hoy", "gd:0"), button("Ayer", "gd:1"), button("Anteayer", "gd:2")]]),
        );
      }
      return;
    }

    case "gp":
      await showConfirmation(ctx, { ...draft, paidBy: id });
      return;

    case "gw":
      if (id in PAYMENT_METHODS) await showConfirmation(ctx, { ...draft, paymentMethod: id as ExpensePaymentMethod });
      return;

    case "gd": {
      const days = Number(id);
      if (!(days >= 0 && days <= 2)) return;
      await showConfirmation(ctx, { ...draft, spentOn: addDaysToDateOnly(todayInFamilyTimezone(), -days) });
      return;
    }

    case "gt": {
      const selected = new Set(draft.splitIds);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      const participants = await listGroupParticipants(ctx.db, ctx.actor.familyId, draft.groupId);
      // Se guarda en el orden del grupo (el que decide el resto); igual
      // `prepareExpense` vuelve a ordenar.
      const splitIds = participants.filter((p) => selected.has(p.id)).map((p) => p.id);
      await askSplit(ctx, { ...draft, splitIds }, participants);
      return;
    }

    case "gs":
      await saveGasto(ctx, group);
      return;
  }
}

async function saveGasto(ctx: BotContext, group: ExpenseGroup) {
  if (ctx.session.state !== "gasto:confirmar") {
    await expiredDialog(ctx, "/gasto");
    return;
  }
  // Toma atómica del paso: un doble toque de "Guardar" no crea dos gastos.
  const claimed = await claimDialog(ctx.db, ctx.session, "gasto:confirmar");
  if (!claimed) return;
  const draft = claimed as unknown as GastoDraft;

  const prepared = await prepare(ctx, draft);
  if (!prepared.ok) {
    await showConfirmation(ctx, draft, prepared.error);
    return;
  }

  const saved = await persistExpense(ctx.db, ctx.actor, prepared, {
    paidBy: draft.paidBy ?? "",
    categoryId: draft.categoryId ?? null,
    description: draft.description ?? "",
    spentOn: draft.spentOn,
    currency: draft.currency,
    paymentMethod: draft.paymentMethod,
    splitMethod: "iguales",
    receiptDocumentId: null,
    notes: null,
  });
  if (!saved.ok) {
    await showConfirmation(ctx, draft, saved.error);
    return;
  }

  const summary = (await listGroupSummaries(ctx.db, ctx.actor.familyId, ctx.actor.memberId)).find(
    (s) => s.group.id === group.id,
  );
  const balance =
    summary && summary.myBalance !== null && summary.isConsistent
      ? `\nEn ${escapeTelegramHtml(group.name)} ${describeBalance(summary.myBalance, formatGuaranies)}.`
      : "";

  await show(
    ctx,
    `✅ Guardado: <b>${escapeTelegramHtml(draft.description ?? "")}</b> — ${formatGuaranies(prepared.amountPyg)}` +
      (draft.currency !== "PYG" ? ` (${currencySymbol(draft.currency)} ${Number(prepared.amount).toLocaleString("es-PY")})` : "") +
      balance,
    keyboard([[button("💸 Otro gasto", "m:g")]]),
  );
}

/** "45000 cena" → importe + descripción. En guaraníes, "45.000" es 45000. */
export function parseAmountAndDescription(
  text: string,
  currency: string,
): { amount: string; description?: string } | null {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (currency === "PYG") {
    const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:\s+(.+))?$/.exec(trimmed);
    if (!match) return null;
    const amount = match[1].replace(/\./g, "").replace(/^0+(?=\d)/, "");
    if (!/^[1-9]\d*$/.test(amount)) return null;
    return { amount, description: match[2]?.slice(0, MAX_DESCRIPTION) };
  }
  const match = /^(\d+(?:[.,]\d{1,2})?)(?:\s+(.+))?$/.exec(trimmed);
  if (!match) return null;
  const amount = match[1].replace(",", ".");
  if (!(Number(amount) > 0)) return null;
  return { amount, description: match[2]?.slice(0, MAX_DESCRIPTION) };
}

export async function handleGastoText(ctx: BotContext, text: string): Promise<void> {
  const state = ctx.session.state;
  if (state === "gasto:grupo") {
    await startGasto(ctx);
    return;
  }
  const draft = draftOf(ctx);
  const group = await getGroup(ctx.db, ctx.actor.familyId, draft.groupId ?? "");
  if (!group) {
    clearDialog(ctx.session);
    await show(ctx, "Ese grupo ya no existe. Empezá de nuevo con /gasto.");
    return;
  }

  if (state === "gasto:monto") {
    const parsed = parseAmountAndDescription(text, draft.currency);
    if (!parsed) {
      await askAmount(
        ctx,
        group,
        draft,
        draft.currency === "PYG"
          ? "No entendí el importe. Escribilo solo con números, sin decimales."
          : "No entendí el importe. Usá números, con hasta dos decimales.",
      );
      return;
    }
    const next: GastoDraft = {
      ...draft,
      amount: parsed.amount,
      description: parsed.description ?? draft.description,
    };
    if (draft.editing) await showConfirmation(ctx, next);
    else if (parsed.description) await askCategory(ctx, group, next);
    else await askDescription(ctx, group, next);
    return;
  }

  if (state === "gasto:descripcion") {
    const description = text.trim().replace(/\s+/g, " ").slice(0, MAX_DESCRIPTION);
    if (!description) return;
    const next = { ...draft, description };
    if (draft.editing) await showConfirmation(ctx, next);
    else await askCategory(ctx, group, next);
    return;
  }

  // En un paso de botones, un texto no significa nada: se vuelve a
  // mostrar el paso, abajo, donde la persona está mirando.
  if (state === "gasto:moneda") await askCurrency(ctx, group, draft);
  else if (state === "gasto:categoria") await askCategory(ctx, group, draft);
  else await showConfirmation(ctx, draft, "Elegí una de las opciones con los botones.");
}
