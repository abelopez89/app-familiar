import { PROMOS_USER_AGENT, diagnosticoRespuesta, htmlATexto } from "./gnb";

/**
 * Fuente Itaú: HTML del servidor (listado por categoría) + detalle por
 * AJAX. Funciones puras para leer el listado, y los dos fetch.
 *
 * Listado: cada promo es un `<a class="item-oferta" onclick="buscar('B','C','Comercio')">`
 * con el nombre en `<h6>` y los badges en `<small class="badge">`
 * ("20 %", "25 % Hasta", "10 Cuotas sin intereses").
 */

export const ITAU_BASE = "https://www.itau.com.py/beneficios2";

/**
 * Categorías que se recorren, como prefiltro: 13 Supermercados,
 * 14 Tecnología, 8 Hogar, 3 Belleza y Salud, 2 Autoaccesorios, 16 Varios.
 * La 0 ("Últimos días") no alcanza.
 */
export const ITAU_CATEGORIAS = [13, 14, 8, 3, 2, 16] as const;

export type ItemListadoItau = {
  b: string;
  c: string;
  comercio: string;
  nombre: string;
  badges: string[];
};

export function claveItau(item: Pick<ItemListadoItau, "b" | "c">): string {
  return `itau:${item.b}:${item.c}`;
}

/** En una línea y con las entidades decodificadas (Itaú escribe "Aret&#233;"). */
function textoPlano(html: string): string {
  return htmlATexto(html).replace(/\s+/g, " ").trim();
}

/** Cada `<a class="item-oferta" …>…</a>` del listado. */
export function bloquesItemOferta(html: string): string[] {
  return html.match(/<a\b[^>]*class="[^"]*\bitem-oferta\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi) ?? [];
}

export function parsearListadoItau(html: string): ItemListadoItau[] {
  const items: ItemListadoItau[] = [];
  for (const bloque of bloquesItemOferta(html)) {
    const onclick = bloque.match(/buscar\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/i);
    if (!onclick) continue;
    const nombre = bloque.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
    const badges = [...bloque.matchAll(/<small[^>]*class="[^"]*\bbadge\b[^"]*"[^>]*>([\s\S]*?)<\/small>/gi)]
      .map((m) => textoPlano(m[1]))
      .filter(Boolean);
    items.push({
      b: onclick[1],
      c: onclick[2],
      comercio: textoPlano(onclick[3]),
      nombre: nombre ? textoPlano(nombre[1]) : textoPlano(onclick[3]),
      badges,
    });
  }
  return items;
}

/** Prefiltro sin Claude: si ningún badge tiene un %, es solo cuotas (o nada). */
export function tienePorcentajeItau(item: Pick<ItemListadoItau, "badges">): boolean {
  return item.badges.some((b) => b.includes("%"));
}

const HEADERS = { "User-Agent": PROMOS_USER_AGENT, Accept: "text/html" };

export type RespuestaItau = { ok: boolean; status: number; html: string; diagnostico: string };

async function pedir(url: string, fetchImpl: typeof fetch): Promise<RespuestaItau> {
  const res = await fetchImpl(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, html: "", diagnostico: await diagnosticoRespuesta(res) };
  return { ok: true, status: res.status, html: await res.text(), diagnostico: "" };
}

export function fetchListadoItau(categoria: number, fetchImpl: typeof fetch = fetch) {
  return pedir(`${ITAU_BASE}/categoria/${categoria}`, fetchImpl);
}

export function fetchDetalleItau(b: string, c: string, fetchImpl: typeof fetch = fetch) {
  return pedir(`${ITAU_BASE}/Detalle?b=${encodeURIComponent(b)}&c=${encodeURIComponent(c)}`, fetchImpl);
}

/**
 * Lo que define si una promo del listado cambió (de acá sale el hash): si
 * comercio y badges siguen iguales, no se vuelve a pedir el detalle.
 */
export function firmaItau(item: ItemListadoItau): string {
  return [item.comercio, ...[...item.badges].sort()].join("|");
}

/**
 * Texto para Claude: listado + detalle (descripción, vigencia, medios de
 * pago y bases, donde están los días y las tarjetas). La categoría del
 * banco no va: el rubro lo decide Claude.
 */
export function textoItau(item: ItemListadoItau, detalleHtml: string): string {
  return [
    `Comercio: ${item.comercio}`,
    `Badges del listado: ${item.badges.join(" · ")}`,
    `Detalle:\n${htmlATexto(detalleHtml)}`,
  ].join("\n");
}

/** Pausa corta entre pedidos al sitio de Itaú. */
export function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
