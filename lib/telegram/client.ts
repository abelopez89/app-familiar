import "server-only";
import { getTelegramBotToken } from "@/lib/env";

// Cliente mínimo de la Bot API de Telegram, con `fetch` y nada más (sin
// Telegraf ni grammY: el webhook ya funcionaba así y una librería traería
// su propio modelo de sesiones). Absorbe el viejo `lib/telegram.ts`:
// `escapeTelegramHtml`, `sendTelegramMessage` y `getTelegramBotUsername`
// se comportan igual que antes; lo nuevo es todo lo que necesita el bot
// conversacional (botones, editar mensajes, responder toques).

export type InlineKeyboardButton = { text: string; callback_data: string };
export type InlineKeyboardMarkup = { inline_keyboard: InlineKeyboardButton[][] };

export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ApiResult<T> = { ok: true; result: T } | { ok: false; description?: string; error_code?: number };

async function callTelegram<T>(method: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  const token = getTelegramBotToken();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!data) return { ok: false, description: `HTTP ${res.status}` };
    if (!data.ok) console.warn(`[telegram] ${method} falló:`, data.description);
    return data;
  } catch (error) {
    console.error(`[telegram] ${method} error de red:`, error);
    return { ok: false, description: "network" };
  }
}

/**
 * Manda un mensaje y devuelve si salió. Es la firma de siempre (la usan
 * los dos crons); `replyMarkup` es opcional y nuevo, para los botones de
 * acción de los avisos.
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<boolean> {
  const result = await sendMessage(chatId, text, replyMarkup);
  return result !== null;
}

/** Como `sendTelegramMessage`, pero devuelve el `message_id` (para editarlo después). */
export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<number | null> {
  const res = await callTelegram<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  return res.ok ? res.result.message_id : null;
}

/**
 * Edita el texto (y los botones) de un mensaje existente. Es lo que hace
 * que el bot se sienta como una app y no como un log: la lista de compras
 * se actualiza en el mismo mensaje en vez de mandar uno nuevo por toque.
 *
 * "message is not modified" (tocar dos veces algo que no cambia nada) se
 * cuenta como éxito: el mensaje ya muestra lo que tiene que mostrar.
 */
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<boolean> {
  const res = await callTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  });
  return res.ok || isNotModified(res);
}

export async function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup: InlineKeyboardMarkup,
): Promise<boolean> {
  const res = await callTelegram("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
  return res.ok || isNotModified(res);
}

function isNotModified(res: ApiResult<unknown>): boolean {
  return !res.ok && (res.description ?? "").includes("message is not modified");
}

/**
 * Hay que llamarlo enseguida en cada toque de botón: si no, Telegram deja
 * el botón con el reloj girando y la persona toca de nuevo. `text` se
 * muestra como un aviso corto arriba del chat.
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export async function setMyCommands(commands: { command: string; description: string }[]): Promise<boolean> {
  const res = await callTelegram("setMyCommands", { commands });
  return res.ok;
}

/**
 * No hay variable de entorno con el username del bot (no la pide el
 * diseño), así que se resuelve con getMe. Se usa solo en la pantalla de
 * vinculación (baja frecuencia), no en el webhook ni en el cron.
 */
export async function getTelegramBotUsername(): Promise<string | null> {
  try {
    const token = getTelegramBotToken();
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.result?.username === "string" ? data.result.username : null;
  } catch {
    return null;
  }
}
