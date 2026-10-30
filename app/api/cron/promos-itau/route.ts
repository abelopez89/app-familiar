import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { ingestaEnCurso } from "@/lib/promos/ingesta";
import { ingestarItau } from "@/lib/promos/ingesta-itau";

/**
 * Ingesta diaria de promos de Itaú (05:15 America/Asuncion), protegida por
 * Authorization: Bearer CRON_SECRET (cron-job.org, como los demás crons).
 * Service role: las promos son globales y no hay sesión.
 *
 * Responde 202 enseguida y trabaja en `after()`: cron-job.org corta la
 * llamada a los ~30 s y la ingesta tarda minutos. Lo que no entra en el
 * presupuesto queda pendiente para la corrida siguiente. El resultado se
 * ve en `promo_ingestas` y al pie de `/promos`.
 */
export const maxDuration = 300;

const PRESUPUESTO_MS = 240_000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getCronSecret()}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = createAdminClient();
  if (await ingestaEnCurso(db, "itau")) {
    return NextResponse.json({ iniciada: false, motivo: "ya hay una ingesta en curso" }, { status: 409 });
  }

  after(async () => {
    const { ok, resumen } = await ingestarItau(db, PRESUPUESTO_MS);
    if (!ok) console.error("[promos-itau] ingesta con errores", resumen);
  });
  return NextResponse.json({ iniciada: true }, { status: 202 });
}
