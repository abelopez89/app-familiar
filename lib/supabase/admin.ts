import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { env, getServiceRoleKey } from "@/lib/env";

/**
 * Cliente con service role. Solo para código de servidor (Server Actions,
 * route handlers) que necesite saltarse RLS deliberadamente — por ejemplo,
 * verificar si un email ya existe como miembro antes de que el usuario
 * tenga sesión. Nunca importar desde un componente cliente.
 */
export function createAdminClient() {
  return createSupabaseClient<Database, "hogar">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    getServiceRoleKey(),
    {
      db: { schema: "hogar" },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
