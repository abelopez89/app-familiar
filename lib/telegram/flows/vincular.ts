import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram/client";

/**
 * `/vincular <código>` — sin cambios respecto de la Fase 2 (se movió acá
 * desde el webhook, nada más).
 */
export async function handleVincular(chatId: number, code: string) {
  const supabase = createAdminClient();

  const { data: linkCode, error: selectError } = await supabase
    .from("telegram_link_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .maybeSingle();

  if (selectError) {
    // No debería pasar nunca con el service role (bypassea RLS). Si
    // aparece, es casi seguro un problema de configuración —
    // SUPABASE_SERVICE_ROLE_KEY mal cargada en Vercel (o cargada para
    // el ambiente equivocado) — no un código inválido de verdad.
    console.error(
      "[telegram webhook] error consultando telegram_link_codes (revisar SUPABASE_SERVICE_ROLE_KEY):",
      selectError,
    );
  } else if (!linkCode) {
    console.warn("[telegram webhook] código no encontrado o ya usado");
  }

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
    "¡Listo! Tu cuenta quedó vinculada 🎉 Te voy a avisar acá los recordatorios de tus eventos.\n\n" +
      "También podés cargar cosas sin abrir la app: escribí /menu para empezar.",
  );
}
