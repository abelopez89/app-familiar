import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelegramWebhookSecret } from "@/lib/env";
import { sendTelegramMessage } from "@/lib/telegram";

const WELCOME_MESSAGE =
  "¡Hola! Soy el bot de App Familiar 👋\n\n" +
  "Por ahora solo mando recordatorios de eventos, uno a la vez — no entiendo " +
  "otros comandos.\n\n" +
  "Para vincular tu cuenta: entrá a la app, andá a Más → Telegram, generá un " +
  "código de 6 dígitos y mandámelo acá con:\n<code>/vincular 123456</code>";

const UNKNOWN_MESSAGE =
  "Por ahora el bot solo envía recordatorios de eventos. Para vincular tu " +
  "cuenta, mandá /vincular seguido del código de 6 dígitos de la app.";

const VINCULAR_PATTERN = /^\/vincular\s+(\d{6})$/;

type TelegramUpdate = {
  message?: {
    text?: string;
    from?: { id?: number };
  };
};

/**
 * Webhook de una vía — no implementa comandos generales, sesiones con
 * estado ni inline keyboards, eso queda para una fase futura (el bot
 * conversacional). Solo entiende /start y /vincular <código>.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== getTelegramWebhookSecret()) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    await handleUpdate(update);
  } catch (error) {
    // Nunca dejar que un error interno se traduzca en algo distinto de
    // 200: si Telegram ve un error, reintenta el mismo update en loop.
    console.error("[telegram webhook] error procesando update:", error);
  }

  return NextResponse.json({ ok: true });
}

async function handleUpdate(update: TelegramUpdate) {
  const chatId = update.message?.from?.id;
  const text = update.message?.text?.trim();

  if (!chatId || !text) return;

  if (text === "/start") {
    await sendTelegramMessage(chatId, WELCOME_MESSAGE);
    return;
  }

  const match = text.match(VINCULAR_PATTERN);
  if (match) {
    await handleVincular(chatId, match[1]);
    return;
  }

  await sendTelegramMessage(chatId, UNKNOWN_MESSAGE);
}

async function handleVincular(chatId: number, code: string) {
  const supabase = createAdminClient();

  const { data: linkCode } = await supabase
    .from("telegram_link_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .maybeSingle();

  // Mensaje de error único para código inexistente o vencido — no
  // revelar cuál de los dos casos es.
  if (!linkCode || new Date(linkCode.expires_at).getTime() < Date.now()) {
    await sendTelegramMessage(
      chatId,
      "Ese código no es válido o ya venció. Generá uno nuevo desde la app.",
    );
    return;
  }

  // La vinculación se resuelve siempre contra member_id, nunca contra
  // email ni contra el alta de auth.users — ese trigger es compartido
  // con otras 3 apps y no dice nada sobre si esta persona ya usa
  // app-familiar.
  const { error: updateError } = await supabase
    .from("family_members")
    .update({ telegram_user_id: chatId })
    .eq("id", linkCode.member_id);

  if (updateError) {
    await sendTelegramMessage(
      chatId,
      "Hubo un problema vinculando tu cuenta. Probá de nuevo en unos minutos.",
    );
    return;
  }

  await supabase
    .from("telegram_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  await sendTelegramMessage(
    chatId,
    "¡Listo! Tu cuenta quedó vinculada 🎉 Te voy a avisar acá los recordatorios de tus eventos.",
  );
}
