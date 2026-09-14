import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Route Handler (no Server Action) porque Google redirige acá con un GET
 * y un `code` en la query string — no hay forma de recibir eso en una
 * Server Action. Excepción deliberada al patrón "mutaciones vía Server
 * Actions" del proyecto, igual que un webhook.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Si el email ya tenía cuenta en otra de las apps que comparten
      // este proyecto de Supabase, auth.users no es una fila nueva y el
      // trigger de alta no se disparó. Esto vincula la familia igual.
      await supabase.rpc("ensure_family_membership");
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("error", "google");
  return NextResponse.redirect(errorUrl);
}
