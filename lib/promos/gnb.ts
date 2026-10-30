/**
 * Fuente GNB: API JSON pública de beneficios (sin auth). Funciones puras
 * para el prefiltro y para armar el texto que se normaliza con Claude.
 *
 * GNB rechaza (403) los pedidos que salen de un servidor aunque la API
 * responde en un navegador: es una decisión del banco y se respeta, así
 * que no hay fetch automático. El JSON se importa a mano (Fase 4).
 *
 * El prefiltro descarta sin gastar una llamada a Claude lo que ya se sabe
 * que no sirve por el `circleText` (el círculo de la tarjeta del sitio:
 * "-20%", "12 cuotas", "x2"). El rubro NO se decide acá: las categorías de
 * GNB no sirven para eso, lo decide Claude.
 */

export const GNB_API_URL =
  "https://www.beneficiosbancognb.com.py/v2/apis/rewards/rewards/v1/benefits/benefits";

export const PROMOS_USER_AGENT = "AppFamiliar/1.0 (promos de tarjetas; uso familiar, 1 request por día)";

export type GnbBenefit = {
  id: string | number;
  title?: string | null;
  miniDescription?: string | null;
  circleText?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  category?: { name?: string | null } | null;
  highlighted?: boolean | null;
  status?: string | null;
};

export function claveGnb(benefit: Pick<GnbBenefit, "id">): string {
  return `gnb:${benefit.id}`;
}

const MONTO_GS = /gs\.?\s*\d[\d.]*/i;
const PORCENTAJE = /\d+\s*%/;

export type Prefiltro = { pasa: true } | { pasa: false; motivo: string };

/**
 * - "-20%" (o cualquier cosa que empiece con un porcentaje) pasa.
 * - "12 cuotas" es solo cuotas: se descarta.
 * - "x2", sorteos, cupones y puntos se descartan.
 * - "Off y Cuotas" pasa solo si la mini descripción trae un % o un monto
 *   en Gs.
 * - Cualquier otro texto pasa solo si el título o la mini descripción
 *   traen un % o un monto: conservador, para no gastar en lo que
 *   seguramente no es un descuento.
 */
export function prefiltrarGnb(benefit: GnbBenefit): Prefiltro {
  const circulo = (benefit.circleText ?? "").trim();
  const mini = benefit.miniDescription ?? "";
  const titulo = benefit.title ?? "";

  if (/^\d+\s*cuotas$/i.test(circulo)) return { pasa: false, motivo: "solo cuotas" };
  if (/^x\s*\d+$/i.test(circulo) || /sorteo|cup[oó]n|puntos|millas/i.test(circulo)) {
    return { pasa: false, motivo: "sorteo, cupón o puntos" };
  }
  if (/^-?\s*\d+\s*%/.test(circulo)) return { pasa: true };
  if (/off\s*y\s*cuotas/i.test(circulo)) {
    return PORCENTAJE.test(mini) || MONTO_GS.test(mini)
      ? { pasa: true }
      : { pasa: false, motivo: "cuotas sin descuento" };
  }
  const texto = `${titulo} ${mini}`;
  return PORCENTAJE.test(texto) || MONTO_GS.test(texto)
    ? { pasa: true }
    : { pasa: false, motivo: "sin porcentaje ni monto" };
}

/** HTML de la descripción a texto plano, suficiente para el modelo. */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&([a-z])acute;/gi, (_, l: string) => ({ a: "á", e: "é", i: "í", o: "ó", u: "ú" })[l.toLowerCase()] ?? l)
    .replace(/&ntilde;/gi, "ñ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Fecha de la API a "yyyy-MM-dd", o null si no se reconoce el formato. */
export function fechaGnb(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

/**
 * El texto que ve Claude y sobre el que se calcula el hash: si no cambia,
 * no se vuelve a normalizar. Va todo lo que puede cambiar el resultado
 * (incluidas las fechas de la API), nada que cambie sin cambiar la promo.
 */
export function textoGnb(benefit: GnbBenefit): string {
  return [
    `Título: ${benefit.title ?? ""}`,
    `Destacado en el círculo: ${benefit.circleText ?? ""}`,
    `Resumen: ${benefit.miniDescription ?? ""}`,
    `Vigencia según la API: ${fechaGnb(benefit.startDate) ?? "?"} a ${fechaGnb(benefit.endDate) ?? "?"}`,
    `Descripción:\n${htmlATexto(benefit.description ?? "")}`,
  ].join("\n");
}

/**
 * Para entender un rechazo (403, 429…) desde la fila de `promo_ingestas`:
 * quién respondió (un firewall anti-bots suele identificarse en `server`
 * o en sus propios encabezados) y el comienzo del cuerpo. Solo registra;
 * no cambia cómo se hace el pedido.
 */
export async function diagnosticoRespuesta(res: Response): Promise<string> {
  const server = res.headers.get("server");
  const firewall = ["cf-ray", "x-akamai-transformed", "x-amz-cf-id", "x-sucuri-id", "x-iinfo"].find((h) =>
    res.headers.has(h),
  );
  let cuerpo = "";
  try {
    cuerpo = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
  } catch {
    // Sin cuerpo legible: alcanza con el resto.
  }
  return [server && `server=${server}`, firewall && `header=${firewall}`, cuerpo && `cuerpo="${cuerpo}"`]
    .filter(Boolean)
    .map((p) => ` · ${p}`)
    .join("");
}
