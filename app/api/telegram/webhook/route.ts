import { NextResponse, type NextRequest } from "next/server";
import { getTelegramWebhookSecret } from "@/lib/env";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/router";

/**
 * Webhook del bot de Telegram (Fase 7: bot conversacional). Valida el
 * secreto y le pasa el update al router (`lib/telegram/router.ts`), que se
 * encarga de la deduplicación por `update_id`, el filtro de chats
 * privados, la vinculación y los flujos.
 *
 * Serverless no tiene trabajo en segundo plano confiable: todo se resuelve
 * ANTES de responder (un par de consultas y un envío por update).
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== getTelegramWebhookSecret()) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    if (typeof update?.update_id === "number") await handleUpdate(update);
  } catch (error) {
    // Nunca dejar que un error interno se traduzca en algo distinto de
    // 200: si Telegram ve un error, reintenta el mismo update en loop.
    console.error("[telegram webhook] error procesando update:", error);
  }

  return NextResponse.json({ ok: true });
}
