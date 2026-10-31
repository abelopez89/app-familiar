import type { Banco } from "./constants";
import { htmlATexto } from "./gnb";

/**
 * Lógica pura de la ingesta por mail (Apps Script de Gmail): de qué banco es
 * un correo, qué imágenes del HTML vale la pena mandarle a Claude y cómo
 * se arma el texto. Sin red ni base: lo usa `ingesta-mail.ts` y lo
 * prueban los tests.
 *
 * Los newsletters de los bancos traen la promo dentro de imágenes (con la
 * letra chica en texto al pie), así que se mandan las dos cosas.
 */

/**
 * Remitentes aceptados, por dominio exacto o subdominio. Un correo de
 * cualquier otro remitente se ignora. Los que pasó el usuario:
 * newsletter@sudamerismail.com.py, basaenterarte@bancobasa.com.py,
 * newsletter@novedades.bancognb.com.py.
 */
const DOMINIOS_BANCO: Array<{ dominio: string; banco: Banco }> = [
  { dominio: "sudamerismail.com.py", banco: "sudameris" },
  { dominio: "sudameris.com.py", banco: "sudameris" },
  { dominio: "bancobasa.com.py", banco: "basa" },
  { dominio: "bancognb.com.py", banco: "gnb" },
  { dominio: "itau.com.py", banco: "itau" },
];

/** `"Banco <x@y.com>"` o `"x@y.com"` → `"x@y.com"` en minúsculas. */
export function emailDe(remitente: string): string {
  const entre = remitente.match(/<([^>]+)>/);
  return (entre ? entre[1] : remitente).trim().toLowerCase();
}

export function bancoDeRemitente(remitente: string): Banco | null {
  const email = emailDe(remitente);
  const dominio = email.split("@")[1];
  if (!dominio) return null;
  const match = DOMINIOS_BANCO.find((d) => dominio === d.dominio || dominio.endsWith(`.${d.dominio}`));
  return match?.banco ?? null;
}

/**
 * La confirmación que manda Gmail al configurar el reenvío. No se procesa:
 * el script nunca la manda, queda por si se vuelve a un reenvío de Gmail.
 */
export function esConfirmacionGmail(remitente: string): boolean {
  return emailDe(remitente) === "forwarding-noreply@google.com";
}

// Lo que casi nunca es la promo: logos, íconos de redes, separadores,
// píxeles de seguimiento.
const PATRONES_DESCARTE =
  /logo|icon|facebook|instagram|twitter|whatsapp|linkedin|youtube|tiktok|spacer|pixel|track|open\.(?:gif|png)|blank\.gif|social|footer|header-?bar/i;

const TAMANO_MINIMO_ATRIBUTO = 120;

export type ImagenHtml = { url: string; alt: string };

function atributo(tag: string, nombre: string): string | null {
  const m = tag.match(new RegExp(`\\b${nombre}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? "").replace(/&amp;/g, "&");
}

/**
 * Las imágenes del HTML que pueden tener la promo, en orden y sin
 * repetir: `https://` (o `cid:` de una imagen adjunta), sin pinta de logo
 * ni ícono, y sin un ancho o alto declarado chico.
 */
export function imagenesDelHtml(html: string): ImagenHtml[] {
  const vistas = new Set<string>();
  const imagenes: ImagenHtml[] = [];
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    const url = atributo(tag, "src")?.trim();
    if (!url || vistas.has(url)) continue;
    if (!/^https:\/\//i.test(url) && !/^cid:/i.test(url)) continue;
    if (PATRONES_DESCARTE.test(url)) continue;
    const ancho = Number(atributo(tag, "width"));
    const alto = Number(atributo(tag, "height"));
    if ((ancho > 0 && ancho < TAMANO_MINIMO_ATRIBUTO) || (alto > 0 && alto < TAMANO_MINIMO_ATRIBUTO)) continue;
    vistas.add(url);
    imagenes.push({ url, alt: atributo(tag, "alt")?.trim() ?? "" });
  }
  return imagenes;
}

/**
 * Para no pedirle al servidor de un mail falsificado una dirección
 * interna: solo https, sin IP literal ni nombres locales.
 */
export function urlImagenPermitida(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") return false;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return false;
  return true;
}

/** El texto del correo para Claude: asunto, cuerpo y los `alt` de las imágenes. */
export function textoDelMail(input: {
  asunto: string;
  textBody: string;
  htmlBody: string;
  imagenes: ImagenHtml[];
}): string {
  const cuerpo = input.htmlBody ? htmlATexto(input.htmlBody) : input.textBody.trim();
  const alts = input.imagenes.map((i) => i.alt).filter((a) => a.length > 0);
  return [
    `Asunto: ${input.asunto}`,
    "",
    cuerpo,
    ...(alts.length > 0 ? ["", "Texto alternativo de las imágenes:", ...alts.map((a) => `- ${a}`)] : []),
  ]
    .join("\n")
    .slice(0, 40_000);
}

// Lo que Claude acepta como imagen (gif incluido) o documento.
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type TipoImagen = (typeof TIPOS_IMAGEN)[number];

export function tipoImagen(contentType: string | null | undefined): TipoImagen | null {
  const tipo = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (tipo === "image/jpg") return "image/jpeg";
  return (TIPOS_IMAGEN as readonly string[]).includes(tipo) ? (tipo as TipoImagen) : null;
}
