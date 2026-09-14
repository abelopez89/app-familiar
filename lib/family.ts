import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Family, FamilyMember } from "@/lib/supabase/types";

export type CurrentFamilyContext = {
  member: FamilyMember;
  family: Family;
};

/**
 * Devuelve el miembro y la familia del usuario autenticado, o null si no
 * hay sesión o el usuario todavía no está vinculado a ningún miembro
 * (no debería pasar una vez que el trigger de alta corrió correctamente).
 */
export async function getCurrentFamilyContext(): Promise<CurrentFamilyContext | null> {
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("family_members")
    .select("*")
    .eq("is_active", true)
    .single();

  if (!member) return null;

  const { data: family } = await supabase
    .from("families")
    .select("*")
    .eq("id", member.family_id)
    .single();

  if (!family) return null;

  return { member, family };
}
