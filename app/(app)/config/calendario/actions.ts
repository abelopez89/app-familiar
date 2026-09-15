"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean; token?: string };

export async function rotateCalendarToken(): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const newToken = randomUUID();

  const supabase = await createClient();
  const { error } = await supabase
    .from("family_members")
    .update({ calendar_token: newToken })
    .eq("id", context.member.id);

  if (error) return { error: "No se pudo rotar el token." };

  revalidatePath("/config/calendario");
  return { success: true, token: newToken };
}
