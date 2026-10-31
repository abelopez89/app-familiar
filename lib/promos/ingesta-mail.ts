import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/services/types";
import type { Json } from "@/lib/supabase/types";
import { env } from "@/lib/env";
import { todayInFamilyTimezone } from "@/lib/dates";
import { escapeTelegramHtml, sendTelegramMessage } from "@/lib/telegram/client";
import { BANCOS, RUBROS, type Banco } from "./constants";
import { filtrarPromo } from "./filtrado";
import { describirComponente } from "./formato";
import { PROMOS_USER_AGENT } from "./gnb";
import { imagenesDelHtml, textoDelMail, tipoImagen, urlImagenPermitida } from "./mail";
import { normalizarPromo, type ArchivoPromo } from "./normalizar";
import { buscarReemplazos, guardarPromoManual } from "./persistencia";
import { existenteEsMasNueva } from "./versiones";

/**
 * Ingesta de promos por mail. Un Google Apps Script en la cuenta de Gmail
 * del usuario (`scripts/gmail-promos.gs`) manda cada newsletter de los
 * bancos a `/api/inbound/promos`, con el mismo JSON que el webhook de
 * Postmark Inbound (Postmark se descartó: no acepta cuentas de Gmail).
 *
 * Es la carga manual (Fase 4) sin la vista previa: la promo se lee con
 * Claude (imágenes + letra chica), pasa por el mismo `filtrarPromo` y se
 * guarda con `guardarPromoManual` (origen `manual`), reemplazando a la
 * vieja salvo que la que ya está parezca más nueva — en ese caso no se
 * guarda nada. Lo que se lee mal se desactiva desde `/promos`.
 *
 * Deja una fila en `promo_ingestas` con `detalle.mail = true` (la lee el
 * pie de `/promos/cargar`) y avisa por Telegram solo si se guardó algo.
 */

// El formato del webhook de Postmark Inbound, que reproduce el Apps Script
// (https://postmarkapp.com/developer/webhooks/inbound-webhook); solo los
// campos que se usan, el resto se ignora.
export const correoPostmarkSchema = z.object({
  From: z.string().default(""),
  Subject: z.string().default(""),
  MessageID: z.string().default(""),
  TextBody: z.string().default(""),
  HtmlBody: z.string().default(""),
  Headers: z.array(z.object({ Name: z.string(), Value: z.string() })).default([]),
  Attachments: z
    .array(
      z.object({
        Name: z.string().default(""),
        Content: z.string().default(""),
        ContentType: z.string().default(""),
        ContentID: z.string().default(""),
      }),
    )
    .default([]),
});
export type CorreoPostmark = z.infer<typeof correoPostmarkSchema>;

const MAX_IMAGENES = 8;
const MAX_BYTES_IMAGEN = 4_500_000; // Claude acepta hasta 5 MB por imagen.
const MIN_BYTES_IMAGEN = 3_000; // Menos que esto es un píxel o un ícono.
const MAX_BYTES_TOTAL = 20_000_000;
const TIMEOUT_IMAGEN_MS = 10_000;

/**
 * El Message-ID original (el que puso el banco) identifica el correo;
 * el script lo manda en `Headers`. Si falta, el id de Gmail.
 */
export function claveMail(correo: CorreoPostmark): string {
  const original = correo.Headers.find((h) => h.Name.toLowerCase() === "message-id")?.Value;
  const id = (original || correo.MessageID || `${correo.From}|${correo.Subject}|${correo.TextBody.length}`).trim();
  return `mail:${createHash("sha256").update(id).digest("hex").slice(0, 32)}`;
}

/**
 * Marca el correo como recibido (en `promo_descartadas`, que es el
 * registro de "ya visto" de las ingestas; la clave `mail:` no choca con
 * las de GNB ni Itaú). Devuelve `false` si ya estaba: el script puede
 * reintentar, y el mismo newsletter puede reenviarse dos veces.
 */
export async function registrarMailRecibido(db: Db, clave: string, asunto: string): Promise<boolean> {
  const { error } = await db
    .from("promo_descartadas")
    .insert({ clave_externa: clave, hash: clave, motivo: `mail recibido: ${asunto}`.slice(0, 200) });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function descargarImagen(url: string): Promise<ArchivoPromo | null> {
  if (!urlImagenPermitida(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": PROMOS_USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_IMAGEN_MS),
      cache: "no-store",
    });
    if (!res.ok || !urlImagenPermitida(res.url || url)) return null;
    const tipo = tipoImagen(res.headers.get("content-type"));
    if (!tipo) return null;
    const largo = Number(res.headers.get("content-length"));
    if (largo > MAX_BYTES_IMAGEN) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < MIN_BYTES_IMAGEN || bytes.length > MAX_BYTES_IMAGEN) return null;
    return { mediaType: tipo, base64: bytes.toString("base64") };
  } catch {
    return null;
  }
}

function bytesBase64(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Las imágenes y PDF del correo: primero los adjuntos (PDF de bases,
 * imágenes inline referenciadas por `cid:` o sueltas), después las
 * imágenes remotas del HTML, en el orden en que aparecen.
 */
async function archivosDelCorreo(correo: CorreoPostmark): Promise<{ archivos: ArchivoPromo[]; alts: ReturnType<typeof imagenesDelHtml> }> {
  const imagenes = imagenesDelHtml(correo.HtmlBody);
  const archivos: ArchivoPromo[] = [];
  let total = 0;
  const agregar = (archivo: ArchivoPromo | null) => {
    if (!archivo) return;
    const bytes = bytesBase64(archivo.base64);
    if (archivos.length >= MAX_IMAGENES || total + bytes > MAX_BYTES_TOTAL) return;
    archivos.push(archivo);
    total += bytes;
  };

  for (const adjunto of correo.Attachments) {
    const tipo = adjunto.ContentType.split(";")[0].trim().toLowerCase();
    const bytes = bytesBase64(adjunto.Content);
    if (tipo === "application/pdf" && bytes <= MAX_BYTES_TOTAL) {
      agregar({ mediaType: "application/pdf", base64: adjunto.Content });
      continue;
    }
    const imagen = tipoImagen(tipo);
    if (!imagen || bytes < MIN_BYTES_IMAGEN || bytes > MAX_BYTES_IMAGEN) continue;
    // Una imagen inline que el HTML no muestra (o que se descartó por
    // logo/ícono) no se manda.
    const cid = adjunto.ContentID.replace(/^<|>$/g, "");
    if (cid && !imagenes.some((i) => i.url.toLowerCase() === `cid:${cid.toLowerCase()}`)) continue;
    agregar({ mediaType: imagen, base64: adjunto.Content });
  }

  const remotas = imagenes.filter((i) => /^https:/i.test(i.url)).slice(0, MAX_IMAGENES);
  // De a dos, para no cargarle pedidos simultáneos al servidor del banco.
  for (let i = 0; i < remotas.length && archivos.length < MAX_IMAGENES; i += 2) {
    const tanda = await Promise.all(remotas.slice(i, i + 2).map((img) => descargarImagen(img.url)));
    tanda.forEach(agregar);
  }
  return { archivos, alts: imagenes };
}

export type ResultadoMail = {
  guardadas: Array<{ id: string; titulo: string; rubro: string; reemplazo: number; detalle: string }>;
  descartadas: Array<{ titulo: string; motivo: string }>;
  archivos: number;
  error?: string;
};

/** Lee el correo con Claude y guarda lo que pase el filtro. No tira: el error va en el resultado. */
export async function procesarMail(db: Db, banco: Banco, correo: CorreoPostmark): Promise<ResultadoMail> {
  const iniciadaEn = new Date().toISOString();
  const resultado: ResultadoMail = { guardadas: [], descartadas: [], archivos: 0 };
  try {
    const { archivos, alts } = await archivosDelCorreo(correo);
    resultado.archivos = archivos.length;
    const texto = textoDelMail({
      asunto: correo.Subject,
      textBody: correo.TextBody,
      htmlBody: correo.HtmlBody,
      imagenes: alts,
    });

    const normalizadas = await normalizarPromo({
      banco,
      origen: "manual",
      hoy: todayInFamilyTimezone(),
      mail: { texto, archivos },
    });

    for (const normalizada of normalizadas) {
      const filtrado = filtrarPromo(normalizada);
      if (!filtrado.ok) {
        resultado.descartadas.push({ titulo: normalizada.titulo, motivo: filtrado.motivo });
        continue;
      }
      const promo = filtrado.promos[0];
      const existentes = await buscarReemplazos(db, banco, promo);
      if (existentes.some((e) => existenteEsMasNueva(e, promo))) {
        resultado.descartadas.push({ titulo: promo.titulo, motivo: "ya había una versión más nueva" });
        continue;
      }
      const id = await guardarPromoManual(db, {
        banco,
        archivoPath: null,
        promo,
        reemplaza: existentes.map((e) => e.id),
      });
      const componentes = promo.beneficios.flatMap((b) => b.componentes).map((c) => describirComponente(c));
      resultado.guardadas.push({
        id,
        titulo: promo.titulo,
        rubro: promo.rubro,
        reemplazo: existentes.length,
        detalle: [...new Set(componentes)].join(", "),
      });
    }
  } catch (error) {
    console.error("[promos-mail]", error);
    resultado.error = error instanceof Error ? error.message : "error desconocido";
  }

  const detalle = {
    mail: true,
    asunto: correo.Subject,
    remitente: correo.From,
    archivos: resultado.archivos,
    guardadas: resultado.guardadas.map(({ titulo, rubro }) => ({ titulo, rubro })),
    descartadas: resultado.descartadas,
    ...(resultado.error ? { error: resultado.error } : {}),
  } satisfies Json;
  const { error: filaError } = await db.from("promo_ingestas").insert({
    banco,
    iniciada_en: iniciadaEn,
    terminada_en: new Date().toISOString(),
    ok: !resultado.error,
    detalle,
  });
  if (filaError) console.error("[promos-mail] no se pudo registrar la corrida", filaError);

  if (resultado.guardadas.length > 0) await avisarGuardadas(db, banco, resultado);
  return resultado;
}

/**
 * Aviso a los miembros con Telegram de las familias que tienen una
 * tarjeta de ese banco. Las promos son globales; a quien no tiene el
 * banco no le sirve enterarse.
 */
async function avisarGuardadas(db: Db, banco: Banco, resultado: ResultadoMail): Promise<void> {
  const { data: tarjetas } = await db.from("tarjetas_familia").select("family_id").eq("banco", banco).eq("activa", true);
  const familias = [...new Set((tarjetas ?? []).map((t) => t.family_id))];
  if (familias.length === 0) return;
  const { data: miembros } = await db
    .from("family_members")
    .select("telegram_user_id")
    .in("family_id", familias)
    .eq("is_active", true)
    .not("telegram_user_id", "is", null);
  if (!miembros?.length) return;

  const lineas = resultado.guardadas.map((g) => {
    const emoji = g.rubro in RUBROS ? RUBROS[g.rubro as keyof typeof RUBROS].emoji : "•";
    const detalle = g.detalle ? ` — ${escapeTelegramHtml(g.detalle)}` : "";
    const reemplazo = g.reemplazo > 0 ? " (actualizada)" : "";
    return `${emoji} <b>${escapeTelegramHtml(g.titulo)}</b>${detalle}${reemplazo}`;
  });
  const texto = [
    `📩 Llegó un mail de ${BANCOS[banco].label} con promos:`,
    "",
    ...lineas,
    "",
    `Si algo se leyó mal, desactivala en ${escapeTelegramHtml(`${env.NEXT_PUBLIC_APP_URL}/promos`)}`,
  ].join("\n");
  await Promise.all(miembros.map((m) => sendTelegramMessage(m.telegram_user_id as number, texto)));
}
