import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Family, FamilyMember } from "@/lib/supabase/types";

export type CurrentFamilyContext = {
  member: FamilyMember;
  family: Family;
};

/**
 * Envuelto en `cache()` de React: el layout de `(app)` y prácticamente
 * cada página lo llaman por separado, y cada llamada cuesta un
 * `auth.getUser()` (round trip a Supabase Auth) más dos consultas. Con
 * `cache()` todo eso se resuelve una sola vez por request y las demás
 * llamadas leen el resultado ya memoizado, sin que ninguna pantalla
 * tenga que pasarse el contexto por props.
 *
 * Devuelve el miembro y la familia del usuario autenticado, o null si no
 * hay sesión o el usuario todavía no está vinculado a ningún miembro.
 *
 * Filtra explícitamente por user_id (no solo por is_active): la consulta
 * anterior dependía de que RLS + is_active dejaran una sola fila visible,
 * lo cual se rompe apenas la familia tiene más de un miembro activo —
 * exactamente el caso normal de esta app. `family_members.user_id` es
 * unique, así que este filtro garantiza como mucho una fila.
 */
export const getCurrentFamilyContext = cache(async function getCurrentFamilyContext(): Promise<CurrentFamilyContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member, error: memberError } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (memberError) {
    console.error(
      "[getCurrentFamilyContext] query family_members falló para user_id",
      user.id,
      ":",
      memberError,
    );
  }

  if (!member) return null;

  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("*")
    .eq("id", member.family_id)
    .maybeSingle();

  if (familyError) {
    console.error(
      "[getCurrentFamilyContext] query families falló para family_id",
      member.family_id,
      ":",
      familyError,
    );
  }

  if (!family) return null;

  return { member, family };
});
