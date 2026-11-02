import "server-only";
import { cache } from "react";
import { headers } from "next/headers";

/**
 * Teléfonos por user-agent: iPhone/iPod, Android con "Mobile" (las
 * tabletas Android no lo llevan) y cualquier navegador que se declare
 * "Mobi". Un iPad con iPadOS se presenta como Mac, así que cuenta como
 * escritorio: recibe las dos vistas y el ancho decide (`lg:`).
 */
const PHONE_UA = /iPhone|iPod|Android.+Mobile|Windows Phone|Mobi/i;

/**
 * Si el pedido viene de un teléfono. Lo usa el inicio para no armar el
 * tablero de escritorio (ni pagar sus consultas) en el celular: un
 * teléfono nunca llega a `lg` (≥ 1024px). Ante la duda (sin user-agent)
 * devuelve `false` y se renderizan las dos vistas, que las clases `lg:`
 * resuelven bien.
 */
export const isPhoneRequest = cache(async function isPhoneRequest(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return PHONE_UA.test(ua);
});
