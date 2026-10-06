import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Capa de servicios (Fase 7). La lógica de negocio que comparten las
 * Server Actions y el bot de Telegram vive en `lib/services/`, con la
 * familia y el miembro como parámetros explícitos:
 *
 * - Una Server Action resuelve `familyId`/`memberId` desde la sesión
 *   (`getCurrentFamilyContext`) y le pasa el cliente de sesión.
 * - El webhook de Telegram los resuelve desde `telegram_user_id` y le
 *   pasa el admin client (service role, sin RLS).
 *
 * Por eso cada consulta de un servicio filtra por `family_id` EN EL
 * CÓDIGO, aunque con el cliente de sesión RLS ya lo haga: con el admin
 * client ese filtro es lo único que separa a una familia de otra (misma
 * situación que el feed ICS de la Fase 2).
 */
export type Db = SupabaseClient<Database, "hogar">;

/** Quién hace la operación: siempre las dos cosas, nunca derivadas adentro. */
export type Actor = { familyId: string; memberId: string };

/**
 * Resultado de un servicio: o un error en español listo para mostrar
 * (el mismo texto que ya mostraba la Server Action), o los datos.
 */
export type ServiceResult<T extends object = object> = { ok: false; error: string } | ({ ok: true } & T);

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
