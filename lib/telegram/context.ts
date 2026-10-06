import "server-only";
import { editMessageReplyMarkup, editMessageText, sendMessage, type InlineKeyboardMarkup } from "@/lib/telegram/client";
import type { BotSession } from "@/lib/telegram/session";
import type { Actor, Db } from "@/lib/services/types";
import type { FamilyMember } from "@/lib/supabase/types";

/**
 * Todo lo que un flujo necesita para atender un update: la base (admin
 * client), quién escribe (miembro + familia, resueltos por
 * `telegram_user_id`), la sesión del diálogo y qué lo disparó.
 */
export type BotContext = {
  db: Db;
  member: FamilyMember;
  actor: Actor;
  session: BotSession;
  chatId: number;
  /** Un toque de botón edita su propio mensaje; un texto escrito no tiene mensaje para editar. */
  trigger: { kind: "text" } | { kind: "callback"; messageId: number };
};

/**
 * Muestra el próximo paso de un flujo.
 *
 * - Si lo disparó un botón, EDITA ese mismo mensaje: el chat no se llena
 *   de copias del mismo menú.
 * - Si lo disparó un texto (un importe, un kilometraje), el mensaje
 *   anterior del bot quedó arriba de lo que escribió la persona: se le
 *   sacan los botones (para que no se toquen pasos viejos) y el paso
 *   nuevo va en un mensaje nuevo, abajo.
 *
 * En los dos casos el mensaje resultante queda como el "vivo" de la
 * sesión (`last_message_id`).
 */
export async function show(ctx: BotContext, text: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  if (ctx.trigger.kind === "callback") {
    const ok = await editMessageText(ctx.chatId, ctx.trigger.messageId, text, replyMarkup);
    if (ok) {
      ctx.session.chatId = ctx.chatId;
      ctx.session.lastMessageId = ctx.trigger.messageId;
      return;
    }
    // Mensaje demasiado viejo para editar (o borrado): va uno nuevo.
  } else {
    await retireLiveMessage(ctx);
  }
  await sendLive(ctx, text, replyMarkup);
}

/** Manda un mensaje nuevo y lo deja como el vivo de la sesión. */
export async function sendLive(ctx: BotContext, text: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  const messageId = await sendMessage(ctx.chatId, text, replyMarkup);
  if (messageId !== null) {
    ctx.session.chatId = ctx.chatId;
    ctx.session.lastMessageId = messageId;
  }
}

/** Le saca los botones al mensaje vivo anterior, si lo hay. */
export async function retireLiveMessage(ctx: BotContext): Promise<void> {
  const { chatId, lastMessageId } = ctx.session;
  if (chatId === ctx.chatId && lastMessageId) {
    await editMessageReplyMarkup(chatId, lastMessageId, { inline_keyboard: [] });
  }
}

/** Reemplaza el texto del mensaje vivo anterior (sin botones), si lo hay. */
export async function settleLiveMessage(ctx: BotContext, text: string): Promise<void> {
  const { chatId, lastMessageId } = ctx.session;
  if (chatId === ctx.chatId && lastMessageId) {
    await editMessageText(chatId, lastMessageId, text);
  }
}
