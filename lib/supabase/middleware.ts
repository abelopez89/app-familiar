import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/registro", "/recuperar"];
const AUTH_FLOW_PATHS = ["/auth/callback"];

// Rutas sin sesión a propósito, además de /auth/callback: las piden
// terceros que no pueden mandar cookies. Si se rompe esto en silencio
// (por ejemplo al tocar el matcher de abajo), estas tres rutas empiezan
// a devolver un redirect a /login en vez de su respuesta real, y el
// error es difícil de diagnosticar del lado del cliente externo.
//   /api/calendar/* — el feed ICS, lo piden Apple Calendar y Google Calendar
//   /api/telegram/*  — el webhook, lo llama Telegram
//   /api/cron/*      — el cron de recordatorios, lo llama cron-job.org
const PUBLIC_API_PATHS = ["/api/calendar", "/api/telegram", "/api/cron"];

export async function updateSession(request: NextRequest) {
  const isPublicApiPath = PUBLIC_API_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (isPublicApiPath) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database, "hogar">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: "hogar" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  const isAuthFlowPath = AUTH_FLOW_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isAuthFlowPath) {
    return response;
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
