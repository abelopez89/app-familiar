import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Family, FamilyMember } from "@/lib/supabase/types";

export type CurrentFamilyContext = {
  member: FamilyMember;
  family: Family;
};

/**
 * Devuelve el miembro y la familia del usuario autenticado, o null si no
 * hay sesión o el usuario todavía no está vinculado a ningún miembro.
 *
 * Filtra explícitamente por user_id (no solo por is_active): la consulta
 * anterior dependía de que RLS + is_active dejaran una sola fila visible,
 * lo cual se rompe apenas la familia tiene más de un miembro activo —
 * exactamente el caso normal de esta app. `family_members.user_id` es
 * unique, así que este filtro garantiza como mucho una fila.
 */
export async function getCurrentFamilyContext(): Promise<CurrentFamilyContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) return null;

  const { data: family } = await supabase
    .from("families")
    .select("*")
    .eq("id", member.family_id)
    .maybeSingle();

  if (!family) return null;

  return { member, family };
}
