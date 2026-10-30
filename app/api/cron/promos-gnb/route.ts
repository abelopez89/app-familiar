import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { ingestarGnb } from "@/lib/promos/ingesta-gnb";

/**
 * Ingesta diaria de promos de GNB (05:00 America/Asuncion), protegida por
 * Authorization: Bearer CRON_SECRET (lo llama cron-job.org, igual que los
 * otros crons). Service role: las promos son globales y no hay sesión.
 *
 * Solo llama a Claude por las promos nuevas o que cambiaron. Si la primera
 * corrida (todo nuevo) no entra en el tiempo de la función, lo que falta
 * queda pendiente y lo toma la corrida siguiente: se puede llamar más de
 * una vez seguida sin efectos raros.
 */
export const maxDuration = 300;

const PRESUPUESTO_MS = 240_000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getCronSecret()}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { ok, resumen } = await ingestarGnb(createAdminClient(), PRESUPUESTO_MS);
  return NextResponse.json({ ok, ...resumen }, { status: ok ? 200 : 500 });
}
