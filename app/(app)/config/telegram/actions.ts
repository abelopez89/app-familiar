"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = {
  error?: string;
  success?: boolean;
  code?: string;
  expiresAt?: string;
};

const CODE_TTL_MS = 10 * 60 * 1000;

function randomSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function generateTelegramLinkCode(): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // El código es primary key: en la práctica casi nunca choca, pero
  // reintenta unas pocas veces por las dudas.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomSixDigitCode();
    const { error } = await supabase.from("telegram_link_codes").insert({
      code,
      member_id: context.member.id,
      family_id: context.family.id,
      expires_at: expiresAt,
    });

    if (!error) return { success: true, code, expiresAt };
    if (error.code !== "23505") return { error: "No se pudo generar el código." };
  }

  return { error: "No se pudo generar el código, probá de nuevo." };
}

export async function unlinkTelegram(): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("family_members")
    .update({ telegram_user_id: null })
    .eq("id", context.member.id);

  if (error) return { error: "No se pudo desvincular." };

  return { success: true };
}
