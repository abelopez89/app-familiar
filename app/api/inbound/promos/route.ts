import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPromosMailSecret } from "@/lib/env";
import { bancoDeRemitente, esConfirmacionGmail } from "@/lib/promos/mail";
import { claveMail, correoPostmarkSchema, procesarMail, registrarMailRecibido } from "@/lib/promos/ingesta-mail";

/**
 * Webhook de Postmark Inbound: un newsletter de un banco reenviado desde
 * Gmail (ver `lib/promos/ingesta-mail.ts`). Postmark manda la URL con
 * usuario y contraseña (`https://promos:<PROMOS_MAIL_SECRET>@…`), que
 * llega como `Authorization: Basic`; el usuario no importa.
 *
 * Responde 200 enseguida y trabaja en `after()`: leer las imágenes con
 * Claude tarda más de lo que Postmark espera, y un error que no sea de
 * autenticación tampoco se arregla reintentando. Un remitente que no es
 * de un banco se ignora con 200 (si no, Postmark reintenta).
 */
export const maxDuration = 300;

function autorizado(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decodificado = Buffer.from(header.slice(6), "base64").toString("utf8");
  const password = Buffer.from(decodificado.slice(decodificado.indexOf(":") + 1));
  const esperado = Buffer.from(getPromosMailSecret());
  return password.length === esperado.length && timingSafeEqual(password, esperado);
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) {
    return new NextResponse("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Basic" } });
  }

  const parsed = correoPostmarkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ procesado: false, motivo: "formato inválido" });
  const correo = parsed.data;

  if (esConfirmacionGmail(correo.From)) {
    // El código de confirmación se lee en la actividad de Postmark.
    console.info("[promos-mail] confirmación de reenvío de Gmail:", correo.Subject);
    return NextResponse.json({ procesado: false, motivo: "confirmación de Gmail" });
  }
  const banco = bancoDeRemitente(correo.From);
  if (!banco) {
    console.info("[promos-mail] remitente ignorado:", correo.From);
    return NextResponse.json({ procesado: false, motivo: "remitente no reconocido" });
  }

  const db = createAdminClient();
  if (!(await registrarMailRecibido(db, claveMail(correo), correo.Subject))) {
    return NextResponse.json({ procesado: false, motivo: "ya recibido" });
  }

  after(async () => {
    await procesarMail(db, banco, correo);
  });
  return NextResponse.json({ procesado: true, banco });
}
