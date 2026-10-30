import "server-only";
import type { Db } from "@/lib/services/types";
import type { Json } from "@/lib/supabase/types";
import { correrIngesta, type ItemFuente } from "./ingesta";
import {
  ITAU_BASE,
  ITAU_CATEGORIAS,
  claveItau,
  fetchDetalleItau,
  fetchListadoItau,
  firmaItau,
  parsearListadoItau,
  pausa,
  textoItau,
  tienePorcentajeItau,
} from "./itau";

const PAUSA_MS = 400;

/**
 * Ingesta de Itaú: recorre las categorías del prefiltro de a una, con
 * pausa entre pedidos, y elimina duplicados entre categorías (la misma
 * promo puede estar en dos). El detalle se pide recién al normalizar, y
 * solo para lo nuevo o lo que cambió de badges (ver `firmaItau`).
 *
 * Si alguna categoría falla, corta: con el listado incompleto se
 * desactivarían promos que siguen vigentes.
 */
export function ingestarItau(db: Db, presupuestoMs: number) {
  return correrIngesta(db, {
    banco: "itau",
    origen: "web",
    presupuestoMs,
    obtenerItems: async () => {
      const items: ItemFuente[] = [];
      const vistas = new Set<string>();
      for (const categoria of ITAU_CATEGORIAS) {
        const listado = await fetchListadoItau(categoria);
        if (!listado.ok) throw new Error(`Itaú respondió ${listado.status} en la categoría ${categoria}${listado.diagnostico}`);
        for (const item of parsearListadoItau(listado.html)) {
          const clave = claveItau(item);
          if (vistas.has(clave)) continue;
          vistas.add(clave);
          items.push({
            clave,
            firma: firmaItau(item),
            urlFuente: `${ITAU_BASE}/categoria/${categoria}`,
            raw: { ...item, categoria } as unknown as Json,
            prefiltro: tienePorcentajeItau(item)
              ? { pasa: true }
              : { pasa: false, motivo: "sin porcentaje en el listado" },
            obtenerTexto: async () => {
              await pausa(PAUSA_MS);
              const detalle = await fetchDetalleItau(item.b, item.c);
              if (!detalle.ok) throw new Error(`detalle ${detalle.status}${detalle.diagnostico}`);
              return textoItau(item, detalle.html);
            },
          });
        }
        await pausa(PAUSA_MS);
      }
      return items;
    },
  });
}
