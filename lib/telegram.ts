import "server-only";
import { getTelegramBotToken } from "@/lib/env";

export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  const token = getTelegramBotToken();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
