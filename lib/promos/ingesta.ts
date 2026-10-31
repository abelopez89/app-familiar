import "server-only";
import type { Db } from "@/lib/services/types";
import type { Json } from "@/lib/supabase/types";
import { todayInFamilyTimezone } from "@/lib/dates";
import { INGESTA_EN_CURSO_MS, type Banco } from "./constants";
import { filtrarPromos } from "./filtrado";
import { normalizarPromo } from "./normalizar";
import { guardarPromoAutomatica, hashContenido, registrarDescartada } from "./persistencia";

/**
 * Esqueleto común de las ingestas (Itaú automática; el JSON de GNB
 * importado a mano): cada fuente entrega su lista de items con clave,
 * firma, prefiltro y cómo obtener el texto completo, y esto decide
 * qué se normaliza con Claude, qué se descarta, qué se desactiva, y deja
 * una fila en `promo_ingestas` para la línea de estado de la pantalla.
 *
 * Costo: solo se llama a Claude por un item cuyo `hash_contenido` cambió
 * (o que nunca se vio). Lo descartado también guarda su hash en
 * `promo_descartadas`, así no se reprocesa todos los días.
 *
 * Tiempo: la función de Vercel tiene un límite. La normalización corre con
 * concurrencia baja hasta `presupuestoMs`; lo que no entró queda pendiente
 * (sin hash) y lo toma la corrida siguiente. Una corrida que no termina
 * todo no es un error.
 */

export type ItemFuente = {
  clave: string;
  /**
   * Lo que define si el item cambió: de acá sale `hash_contenido`. En GNB
   * es el texto entero; en Itaú, lo que dice el listado (comercio y
   * badges), así el detalle se pide solo para lo nuevo o cambiado.
   */
  firma: string;
  /** El texto que se normaliza con Claude; se pide solo si hace falta. */
  obtenerTexto: () => Promise<string>;
  urlFuente: string | null;
  raw: Json;
  prefiltro: { pasa: true } | { pasa: false; motivo: string };
};

export type ResumenIngesta = {
  total: number;
  sinCambios: number;
  prefiltradas: number;
  normalizadas: number;
  descartadas: number;
  desactivadas: number;
  pendientes: number;
  errores: string[];
};

// Baja a propósito: cada item de Itaú es un pedido al sitio del banco
// además de la llamada a Claude.
const CONCURRENCIA = 2;

/** Los errores de Supabase son objetos con `message`, no instancias de Error. */
function mensaje(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

/**
 * Si hay una corrida de ese banco en curso. Dos corridas a la vez
 * normalizarían las mismas promos dos veces (doble costo y escrituras
 * pisadas), así que la ruta del cron y el botón de `/promos` lo
 * consultan antes de arrancar.
 */
export async function ingestaEnCurso(db: Db, banco: Banco): Promise<boolean> {
  const desde = new Date(Date.now() - INGESTA_EN_CURSO_MS).toISOString();
  const { data } = await db
    .from("promo_ingestas")
    .select("id")
    .eq("banco", banco)
    .is("terminada_en", null)
    .gte("iniciada_en", desde)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function correrIngesta(
  db: Db,
  input: {
    banco: Banco;
    origen: "api" | "web";
    obtenerItems: () => Promise<ItemFuente[]>;
    presupuestoMs: number;
    /**
     * Desactivar las promos del banco que no vinieron en esta corrida. Sí
     * cuando la fuente trae la lista completa (Itaú); no cuando llega por
     * partes (el JSON de GNB importado en tandas desde el navegador).
     */
    desactivarFaltantes?: boolean;
  },
): Promise<{ ok: boolean; resumen: ResumenIngesta }> {
  const inicio = Date.now();
  const { data: ingesta } = await db.from("promo_ingestas").insert({ banco: input.banco }).select("id").single();

  const resumen: ResumenIngesta = {
    total: 0,
    sinCambios: 0,
    prefiltradas: 0,
    normalizadas: 0,
    descartadas: 0,
    desactivadas: 0,
    pendientes: 0,
    errores: [],
  };

  let ok = false;
  try {
    const items = await input.obtenerItems();
    // Sin items es casi seguro que la fuente cambió de forma o falló en
    // silencio: cortar acá evita desactivar todas las promos del banco.
    if (items.length === 0) throw new Error("la fuente no devolvió ninguna promo");
    resumen.total = items.length;

    const prefijo = `${input.banco}:`;
    const [{ data: existentes, error: e1 }, { data: descartadas, error: e2 }] = await Promise.all([
      db.from("promociones").select("id, clave_externa, hash_contenido, activa").eq("banco", input.banco).eq("origen", input.origen),
      db.from("promo_descartadas").select("clave_externa, hash").like("clave_externa", `${prefijo}%`),
    ]);
    if (e1 || e2) throw e1 ?? e2;

    const porClave = new Map((existentes ?? []).map((p) => [p.clave_externa, p]));
    const descartadaPorClave = new Map((descartadas ?? []).map((d) => [d.clave_externa, d.hash]));
    const vistas = new Set<string>();
    const pendientes: Array<ItemFuente & { hash: string }> = [];
    const reactivar: string[] = [];

    for (const item of items) {
      if (vistas.has(item.clave)) continue;
      vistas.add(item.clave);
      const hash = hashContenido(item.firma);
      const existente = porClave.get(item.clave);

      if (!item.prefiltro.pasa) {
        resumen.prefiltradas++;
        if (descartadaPorClave.get(item.clave) !== hash || existente?.activa) {
          await registrarDescartada(db, item.clave, hash, item.prefiltro.motivo);
        }
        continue;
      }
      if (existente?.hash_contenido === hash) {
        resumen.sinCambios++;
        if (!existente.activa) reactivar.push(existente.id);
        continue;
      }
      if (!existente && descartadaPorClave.get(item.clave) === hash) {
        resumen.sinCambios++;
        continue;
      }
      pendientes.push({ ...item, hash });
    }

    // Lo que ya no está en la fuente deja de verse (no se borra).
    const desaparecidas =
      input.desactivarFaltantes === false
        ? []
        : (existentes ?? []).filter((p) => p.activa && p.clave_externa && !vistas.has(p.clave_externa));
    if (desaparecidas.length > 0) {
      const { error } = await db.from("promociones").update({ activa: false }).in("id", desaparecidas.map((p) => p.id));
      if (error) throw error;
      resumen.desactivadas = desaparecidas.length;
    }
    if (reactivar.length > 0) {
      const { error } = await db.from("promociones").update({ activa: true }).in("id", reactivar);
      if (error) throw error;
    }

    const hoy = todayInFamilyTimezone();
    let siguiente = 0;
    async function trabajador() {
      while (siguiente < pendientes.length && Date.now() - inicio < input.presupuestoMs) {
        const item = pendientes[siguiente++];
        try {
          const texto = await item.obtenerTexto();
          const normalizadas = await normalizarPromo({ banco: input.banco, origen: input.origen, texto, hoy });
          const filtrado = filtrarPromos(normalizadas.slice(0, 1));
          if (!filtrado.ok) {
            await registrarDescartada(db, item.clave, item.hash, filtrado.motivo);
            resumen.descartadas++;
          } else {
            await guardarPromoAutomatica(db, {
              banco: input.banco,
              origen: input.origen,
              clave: item.clave,
              hash: item.hash,
              urlFuente: item.urlFuente,
              raw: item.raw,
              promo: filtrado.promos[0],
            });
            resumen.normalizadas++;
          }
        } catch (error) {
          resumen.errores.push(`${item.clave}: ${mensaje(error)}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
    resumen.pendientes = pendientes.length - siguiente;

    // Algún item suelto que falla (un texto raro) no rompe la fuente; que
    // fallen todos los que se intentaron, sí.
    const intentadas = resumen.normalizadas + resumen.descartadas + resumen.errores.length;
    ok = intentadas === 0 || resumen.errores.length < intentadas;
  } catch (error) {
    resumen.errores.push(mensaje(error));
    ok = false;
  }

  if (ingesta) {
    await db
      .from("promo_ingestas")
      .update({ terminada_en: new Date().toISOString(), ok, detalle: resumen as unknown as Json })
      .eq("id", ingesta.id);
  }
  return { ok, resumen };
}
