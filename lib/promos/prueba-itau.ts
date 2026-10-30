import "server-only";
import type { Db } from "@/lib/services/types";
import type { Json } from "@/lib/supabase/types";
import { bloquesItemOferta, fetchDetalleItau, fetchListadoItau, parsearListadoItau, tienePorcentajeItau } from "./itau";

/**
 * Prueba de conexión con Itaú, antes de construir la ingesta completa
 * (Fase 3): GNB rechaza los pedidos que salen de Vercel (403) aunque su API
 * responde en un navegador, y eso se respeta. Acá se averigua si Itaú
 * hace lo mismo con dos pedidos: el listado de Supermercados y el detalle
 * de una promo con %.
 *
 * Sin Claude y sin guardar promos. Deja una fila en `promo_ingestas` con
 * `detalle.prueba = true`, el estado de cada pedido y una muestra corta
 * del HTML real, para escribir el parser sobre datos verdaderos.
 */

const CATEGORIA_PRUEBA = 13;

export type ResultadoPrueba = { ok: boolean; mensaje: string };

export async function probarItau(db: Db): Promise<ResultadoPrueba> {
  const { data: fila } = await db.from("promo_ingestas").insert({ banco: "itau" }).select("id").single();

  let resultado: ResultadoPrueba;
  const detalle: Record<string, Json> = { prueba: true };
  try {
    const listado = await fetchListadoItau(CATEGORIA_PRUEBA);
    const items = listado.ok ? parsearListadoItau(listado.html) : [];
    const bloques = listado.ok ? bloquesItemOferta(listado.html) : [];
    detalle.listado = {
      status: listado.status,
      diagnostico: listado.diagnostico,
      bytes: listado.html.length,
      bloques: bloques.length,
      items: items.length,
      conPorcentaje: items.filter(tienePorcentajeItau).length,
      muestraItems: items.slice(0, 5),
      muestraHtml: bloques.length > 0 ? bloques.slice(0, 2).join("\n").slice(0, 1500) : listado.html.slice(0, 1500),
    };

    if (!listado.ok) {
      resultado = { ok: false, mensaje: `Itaú rechazó el pedido (${listado.status}).` };
    } else if (items.length === 0) {
      resultado = { ok: false, mensaje: "Itaú respondió, pero no se reconoció ninguna promo en el listado." };
    } else {
      const conPorcentaje = items.find(tienePorcentajeItau) ?? items[0];
      const det = await fetchDetalleItau(conPorcentaje.b, conPorcentaje.c);
      detalle.detalle = {
        status: det.status,
        diagnostico: det.diagnostico,
        bytes: det.html.length,
        de: conPorcentaje,
        muestraHtml: det.html.slice(0, 2500),
      };
      resultado = det.ok
        ? { ok: true, mensaje: `Itaú respondió: ${items.length} promos en Supermercados, y el detalle también.` }
        : { ok: false, mensaje: `Itaú respondió el listado (${items.length} promos) pero rechazó el detalle (${det.status}).` };
    }
  } catch (error) {
    detalle.error = error instanceof Error ? error.message : String(error);
    resultado = { ok: false, mensaje: "No se pudo conectar con Itaú." };
  }

  if (fila) {
    await db
      .from("promo_ingestas")
      .update({ terminada_en: new Date().toISOString(), ok: resultado.ok, detalle: detalle as Json })
      .eq("id", fila.id);
  }
  return resultado;
}
