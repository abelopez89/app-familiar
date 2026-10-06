import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerCallbackQuery, sendMessage, type InlineKeyboardMarkup } from "@/lib/telegram/client";
import { button, keyboard, NOOP } from "@/lib/telegram/keyboards";
import { clearDialog, loadSession, saveSession } from "@/lib/telegram/session";
import { show, type BotContext } from "@/lib/telegram/context";
import { handleVincular } from "@/lib/telegram/flows/vincular";
import { handleComprasCallback, handleComprasText, startCompras } from "@/lib/telegram/flows/compras";
import { handleGastoCallback, handleGastoText, startGasto } from "@/lib/telegram/flows/gastos";
import { handleNaftaCallback, handleNaftaText, startNafta } from "@/lib/telegram/flows/combustible";
import { handleHoyCallback, sendHoy } from "@/lib/telegram/flows/hoy";
import type { Db } from "@/lib/services/types";
import type { FamilyMember } from "@/lib/supabase/types";

// Router del bot: decide qué hacer con cada update de Telegram.
//
// Orden fijo, y cada paso existe por un motivo:
//  1. Solo chats privados. En un grupo no se sabe de forma confiable quién
//     pide qué, y con varios miembros vinculados se cargarían gastos a
//     nombre equivocado. Un update de un grupo se ignora sin responder.
//  2. Deduplicación por `update_id`: Telegram reintenta si el webhook
//     tarda, y un reintento de "guardar gasto" crearía un gasto
//     duplicado. Se inserta en `telegram_updates` ANTES de procesar; si
//     choca contra la primary key, ya se procesó y no se hace nada.
//  3. `answerCallbackQuery` enseguida en cada toque de botón.
//  4. Vinculación: `/start` y `/vincular` andan siempre; cualquier otra
//     cosa de alguien no vinculado recibe la instrucción de vincularse y
//     nada más.
//  5. Un comando corta cualquier diálogo a medias y arranca el suyo; un
//     texto suelto se interpreta según el paso del diálogo en curso.
//
// Los flujos (lib/telegram/flows/) no consultan la base para la lógica de
// negocio: llaman a lib/services/, igual que las Server Actions.

export type TelegramUser = { id: number; first_name?: string };
export type TelegramChat = { id: number; type: string };
export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  reply_markup?: InlineKeyboardMarkup;
};
export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

const VINCULAR_PATTERN = /^\/vincular(?:@\w+)?\s+(\d{6})$/;

const NOT_LINKED_MESSAGE =
  "Todavía no vinculaste tu cuenta.\n\n" +
  "Entrá a la app, andá a <b>Ajustes → Telegram</b>, generá un código de 6 dígitos y mandámelo acá con:\n" +
  "<code>/vincular 123456</code>";

const WELCOME_UNLINKED =
  "¡Hola! Soy el bot de App Familiar 👋\n\n" + NOT_LINKED_MESSAGE;

export const MAIN_MENU = keyboard([
  [button("🛒 Compras", "m:c"), button("💸 Gasto", "m:g")],
  [button("⛽ Combustible", "m:f"), button("📅 Hoy", "m:h")],
]);

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const callback = update.callback_query;
  const chat = message?.chat ?? callback?.message?.chat;
  const from = message?.from ?? callback?.from;

  // 1. Solo chats privados (y solo mensajes de texto o toques de botón).
  if (!chat || !from || chat.type !== "private") return;
  if (!callback && !message?.text) return;

  const db = createAdminClient();

  // 2. Deduplicación: el insert es el lock.
  const { error: dedupError } = await db.from("telegram_updates").insert({ update_id: update.update_id });
  if (dedupError) {
    if (dedupError.code !== "23505") console.error("[telegram] no se pudo registrar el update:", dedupError);
    return;
  }

  // 3. El toque se responde ya; el trabajo viene después.
  const answered = callback ? answerCallbackQuery(callback.id) : Promise.resolve();

  try {
    await dispatch(db, chat.id, from, message, callback);
  } finally {
    await answered;
  }
}

async function dispatch(
  db: Db,
  chatId: number,
  from: TelegramUser,
  message: TelegramMessage | undefined,
  callback: TelegramCallbackQuery | undefined,
): Promise<void> {
  const text = message?.text?.trim() ?? "";

  // 4. Vinculación. /vincular anda aunque ya esté vinculado (re-vincular
  // a otro miembro, mismo comportamiento que antes).
  if (message) {
    const match = text.match(VINCULAR_PATTERN);
    if (match) {
      // En un chat privado chat.id === from.id; se vincula el usuario.
      await handleVincular(from.id, match[1]);
      return;
    }
  }

  const member = await resolveMember(db, from.id);

  if (!member) {
    if (message && /^\/start\b/.test(text)) {
      await sendMessage(chatId, WELCOME_UNLINKED);
    } else {
      await sendMessage(chatId, NOT_LINKED_MESSAGE);
    }
    return;
  }

  const session = await loadSession(db, from.id, member);
  const ctx: BotContext = {
    db,
    member,
    actor: { familyId: member.family_id, memberId: member.id },
    session,
    chatId,
    trigger: callback?.message ? { kind: "callback", messageId: callback.message.message_id } : { kind: "text" },
  };

  try {
    if (callback) {
      await routeCallback(ctx, callback.data ?? "", callback.message);
    } else if (text.startsWith("/")) {
      // 5. Cualquier comando descarta el diálogo anterior.
      clearDialog(session);
      await routeCommand(ctx, text);
    } else {
      await routeText(ctx, text);
    }
  } finally {
    await saveSession(db, session);
  }
}

/**
 * El miembro vinculado a este usuario de Telegram. Siempre por
 * `family_members.telegram_user_id` → `member_id`, nunca por email ni por
 * `auth.users` (compartida con otras tres apps). De acá sale la familia
 * con la que se filtra todo lo demás.
 */
async function resolveMember(db: Db, telegramUserId: number): Promise<FamilyMember | null> {
  const { data } = await db
    .from("family_members")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function routeCommand(ctx: BotContext, text: string): Promise<void> {
  // "/gasto@MiBot 45000" → "/gasto"
  const command = text.split(/\s+/)[0].replace(/@\w+$/, "").toLowerCase();

  switch (command) {
    case "/start":
    case "/menu":
      await show(ctx, `¿Qué querés hacer, ${firstName(ctx.member)}?`, MAIN_MENU);
      return;
    case "/hoy":
      await sendHoy(ctx);
      return;
    case "/compra":
    case "/compras":
      await startCompras(ctx);
      return;
    case "/gasto":
      await startGasto(ctx);
      return;
    case "/nafta":
    case "/combustible":
      await startNafta(ctx);
      return;
    case "/cancelar":
      await show(ctx, "Listo, cancelado.", MAIN_MENU);
      return;
    case "/vincular":
      await show(ctx, "Para vincular otra cuenta mandá <code>/vincular</code> seguido del código de 6 dígitos de la app.");
      return;
    default:
      await show(ctx, "No conozco ese comando. Elegí una opción:", MAIN_MENU);
  }
}

async function routeText(ctx: BotContext, text: string): Promise<void> {
  const state = ctx.session.state ?? "";
  if (state.startsWith("compras:")) return handleComprasText(ctx, text);
  if (state.startsWith("gasto:")) return handleGastoText(ctx, text);
  if (state.startsWith("nafta:")) return handleNaftaText(ctx, text);

  // Sin diálogo en curso (o venció): no se adivina qué quiso decir.
  await show(ctx, "No hay nada en curso. Elegí una opción:", MAIN_MENU);
}

async function routeCallback(ctx: BotContext, data: string, message: TelegramMessage | undefined): Promise<void> {
  if (data === NOOP) return;

  if (data === "x") {
    clearDialog(ctx.session);
    await show(ctx, "Listo, cancelado.", MAIN_MENU);
    return;
  }

  if (data.startsWith("m:")) {
    clearDialog(ctx.session);
    const choice = data.slice(2);
    if (choice === "c") return startCompras(ctx);
    if (choice === "g") return startGasto(ctx);
    if (choice === "f") return startNafta(ctx);
    if (choice === "h") return sendHoy(ctx);
    return;
  }

  const action = data.split(":")[0];
  if (action === "th" || action === "ag" || action === "hl") return handleHoyCallback(ctx, data, message);
  if (action.startsWith("l")) return handleComprasCallback(ctx, data);
  if (action.startsWith("g")) return handleGastoCallback(ctx, data);
  if (action.startsWith("f")) return handleNaftaCallback(ctx, data);
}

export function firstName(member: FamilyMember): string {
  return member.display_name.split(" ")[0];
}

/**
 * El paso al que pertenece un botón ya no está activo (venció la sesión,
 * se canceló, o es un mensaje viejo). Se avisa en el mismo mensaje.
 */
export async function expiredDialog(ctx: BotContext, restartCommand: string): Promise<void> {
  await show(ctx, `Este diálogo ya venció. Empezá de nuevo con ${restartCommand}.`, MAIN_MENU);
}
