import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { enviarAvisosPromos } from "@/lib/promos/avisos-envio";

/**
 * Avisos de promos por Telegram (Fase 5). cron-job.org lo llama **cada
 * hora** con Authorization: Bearer CRON_SECRET; la ruta decide qué toca
 * según la hora de Asunción y no repite lo que ya mandó ese día (ver
 * `lib/promos/avisos-envio.ts`). Sin nada para avisar, no manda nada.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getCronSecret()}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const resumen = await enviarAvisosPromos(createAdminClient());
    return NextResponse.json(resumen);
  } catch (error) {
    console.error("[promos-avisos]", error);
    return NextResponse.json({ error: "no se pudieron mandar los avisos" }, { status: 500 });
  }
}
