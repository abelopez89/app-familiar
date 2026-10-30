import "server-only";
import { createHash } from "node:crypto";
import type { Db } from "@/lib/services/types";
import type { Json } from "@/lib/supabase/types";
import type { Banco } from "./constants";
import type { PromoFiltrada } from "./filtrado";

/**
 * Escritura de promos con el admin client (las tablas de promos no tienen
 * política de escritura para `authenticated`, ver migración 014). Común a
 * todas las fuentes.
 *
 * PostgREST no tiene transacciones entre requests, así que el orden cubre
 * los fallos a mitad de camino: la promo se guarda con `activa = false` y
 * sin `hash_contenido`, después las capas, y recién al final se marca
 * activa con su hash. Si algo falla en el medio, la promo queda invisible
 * y sin hash, y la próxima corrida la vuelve a procesar (el hash no
 * coincide) en vez de dejar una promo a medias a la vista.
 */

export function hashContenido(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

async function reemplazarCapas(db: Db, promoId: string, promo: PromoFiltrada): Promise<void> {
  const del = await Promise.all([
    db.from("promo_comercios").delete().eq("promo_id", promoId),
    db.from("promo_beneficios").delete().eq("promo_id", promoId),
  ]);
  for (const r of del) if (r.error) throw r.error;

  if (promo.comercios.length > 0) {
    const { error } = await db.from("promo_comercios").insert(
      promo.comercios.map((c) => ({ promo_id: promoId, comercio_nombre: c.nombre, desde: c.desde, hasta: c.hasta })),
    );
    if (error) throw error;
  }

  const { data: beneficios, error } = await db
    .from("promo_beneficios")
    .insert(
      promo.beneficios.map((b) => ({
        promo_id: promoId,
        nombre: b.nombre,
        dias_semana: b.dias_semana,
        fechas: b.fechas,
        prioridad: b.prioridad,
      })),
    )
    .select("id");
  if (error || !beneficios || beneficios.length !== promo.beneficios.length) {
    throw error ?? new Error("no se insertaron todas las capas");
  }

  const componentes = promo.beneficios.flatMap((b, i) =>
    b.componentes.map((c) => ({ beneficio_id: beneficios[i].id, ...c })),
  );
  const tarjetas = promo.beneficios.flatMap((b, i) => b.tarjetas.map((t) => ({ beneficio_id: beneficios[i].id, ...t })));

  const ins = await Promise.all([
    db.from("promo_beneficio_componentes").insert(componentes),
    tarjetas.length > 0 ? db.from("promo_beneficio_tarjetas").insert(tarjetas) : Promise.resolve({ error: null }),
  ]);
  for (const r of ins) if (r.error) throw r.error;
}

/**
 * Crea o actualiza la promo de una clave externa (GNB, Itaú). Una sola
 * promo por clave: `clave_externa` es unique.
 */
export async function guardarPromoAutomatica(
  db: Db,
  input: {
    banco: Banco;
    origen: "api" | "web";
    clave: string;
    hash: string;
    urlFuente: string | null;
    raw: Json;
    promo: PromoFiltrada;
  },
): Promise<void> {
  const fila = {
    banco: input.banco,
    origen: input.origen,
    clave_externa: input.clave,
    titulo: input.promo.titulo,
    resumen: input.promo.resumen,
    rubro: input.promo.rubro,
    url_fuente: input.urlFuente,
    vigencia_desde: input.promo.vigencia_desde,
    vigencia_hasta: input.promo.vigencia_hasta,
    canal: input.promo.canal,
    acumulable: input.promo.acumulable,
    raw: input.raw,
    activa: false,
    hash_contenido: null,
  };

  const { data, error } = await db
    .from("promociones")
    .upsert(fila, { onConflict: "clave_externa" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("no se pudo guardar la promo");

  await reemplazarCapas(db, data.id, input.promo);

  const { error: finalError } = await db
    .from("promociones")
    .update({ activa: true, hash_contenido: input.hash })
    .eq("id", data.id);
  if (finalError) throw finalError;

  // Si antes se había descartado, ya no lo está.
  await db.from("promo_descartadas").delete().eq("clave_externa", input.clave);
}

export async function registrarDescartada(db: Db, clave: string, hash: string, motivo: string): Promise<void> {
  const { error } = await db
    .from("promo_descartadas")
    .upsert({ clave_externa: clave, hash, motivo, descartada_en: new Date().toISOString() }, { onConflict: "clave_externa" });
  if (error) throw error;
  // Una promo que antes servía y ahora no (el banco la cambió) deja de verse.
  await db.from("promociones").update({ activa: false }).eq("clave_externa", clave);
}
