import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/services/types";
import { getCurrentFamilyContext } from "@/lib/family";
import { INGESTA_EN_CURSO_MS, type Banco } from "./constants";
import type { PromoParaMatch } from "./matching";

/**
 * Lecturas de la pantalla de promos, con el cliente de sesión: las promos
 * son de lectura para cualquier autenticado (migración 014) y las tarjetas
 * las filtra RLS por familia (además del `.eq` explícito).
 */

const SELECT_PROMO = `
  id, banco, titulo, resumen, rubro, vigencia_desde, vigencia_hasta, canal, activa, origen, archivo_path,
  promo_comercios ( comercio_nombre, desde, hasta ),
  promo_beneficios (
    nombre, dias_semana, fechas, prioridad,
    promo_beneficio_componentes ( tipo, porcentaje, monto, cuotas, es_hasta, alcance, tope_monto, tope_periodo, tope_alcance ),
    promo_beneficio_tarjetas ( regla, marca, nivel, afinidad, tipo )
  )
`;

export type PromoConCapas = PromoParaMatch & {
  id: string;
  titulo: string;
  resumen: string | null;
  rubro: string;
  canal: string | null;
  origen: "api" | "web" | "manual";
  archivo_path: string | null;
  comercios: Array<{ comercio_nombre: string; desde: string | null; hasta: string | null }>;
  beneficios: Array<PromoParaMatch["beneficios"][number] & { nombre: string }>;
};

/**
 * Promos activas que no vencieron antes de `desde`. La vigencia inicial y
 * los días se resuelven en `matching.ts`, no en la consulta.
 */
export const listarPromosActivas = cache(async function listarPromosActivas(desde: string): Promise<PromoConCapas[]> {
  return listarPromos(desde, true);
});

/**
 * Las desactivadas que no vencieron, sin las reemplazadas por una versión
 * nueva (esas son historial, no algo para reactivar). Para "Todas las
 * promos".
 */
export const listarPromosDesactivadas = cache(async function listarPromosDesactivadas(
  desde: string,
): Promise<PromoConCapas[]> {
  return listarPromos(desde, false);
});

async function listarPromos(desde: string, activa: boolean): Promise<PromoConCapas[]> {
  return leerPromos(await createClient(), desde, activa);
}

/**
 * La consulta de promos con el cliente que se le pase: el de sesión para
 * las pantallas, el admin para los avisos del cron (las promos son
 * globales, no hay `family_id` que filtrar).
 */
export async function leerPromos(supabase: Db, desde: string, activa: boolean): Promise<PromoConCapas[]> {
  let query = supabase
    .from("promociones")
    .select(SELECT_PROMO)
    .eq("activa", activa)
    .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${desde}`);
  if (!activa) query = query.is("reemplazada_por", null);
  const { data, error } = await query;
  if (error) {
    console.error("[listarPromos]", error);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    banco: p.banco,
    activa: p.activa,
    titulo: p.titulo,
    resumen: p.resumen,
    rubro: p.rubro,
    canal: p.canal,
    origen: p.origen,
    archivo_path: p.archivo_path,
    vigencia_desde: p.vigencia_desde,
    vigencia_hasta: p.vigencia_hasta,
    comercios: p.promo_comercios,
    beneficios: p.promo_beneficios.map((b) => ({
      nombre: b.nombre,
      dias_semana: b.dias_semana,
      fechas: b.fechas,
      prioridad: b.prioridad,
      componentes: b.promo_beneficio_componentes,
      tarjetas: b.promo_beneficio_tarjetas,
    })),
  }));
}

export const listarTarjetasActivas = cache(async function listarTarjetasActivas() {
  const context = await getCurrentFamilyContext();
  if (!context) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarjetas_familia")
    .select("*")
    .eq("family_id", context.family.id)
    .eq("activa", true)
    .order("created_at");
  return data ?? [];
});

export type EstadoIngesta = {
  banco: Banco;
  ultimaOk: string | null;
  ultimaFallo: boolean;
  /** La última corrida empezó hace menos de 6 minutos y no terminó. */
  enCurso: boolean;
  /** De la última corrida terminada: lo que quedó para la próxima. */
  pendientes: number;
  errores: number;
};

/** Última ingesta OK por banco, y cómo terminó la última de todas. */
export const estadoIngestas = cache(async function estadoIngestas(): Promise<EstadoIngesta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_ingestas")
    .select("banco, ok, terminada_en, iniciada_en, detalle")
    .order("iniciada_en", { ascending: false })
    .limit(60);

  const ahora = Date.now();
  const porBanco = new Map<Banco, EstadoIngesta>();
  for (const fila of data ?? []) {
    // Los mails no son una corrida de la fuente: tienen su propia lista (`ultimosMails`).
    if ((fila.detalle as { mail?: boolean } | null)?.mail === true) continue;
    let estado = porBanco.get(fila.banco);
    if (!estado) {
      // La fila más nueva del banco: de ella salen el estado y el detalle.
      const detalle = (fila.detalle ?? {}) as { pendientes?: number; errores?: unknown[] };
      estado = {
        banco: fila.banco,
        ultimaOk: null,
        ultimaFallo: !fila.ok && fila.terminada_en !== null,
        enCurso: fila.terminada_en === null && ahora - new Date(fila.iniciada_en).getTime() < INGESTA_EN_CURSO_MS,
        pendientes: detalle.pendientes ?? 0,
        errores: detalle.errores?.length ?? 0,
      };
      porBanco.set(fila.banco, estado);
    }
    // Una prueba de conexión OK no es una actualización de promos.
    const esPrueba = (fila.detalle as { prueba?: boolean } | null)?.prueba === true;
    if (fila.ok && !esPrueba && !estado.ultimaOk) estado.ultimaOk = fila.terminada_en;
  }
  return [...porBanco.values()];
});

export type MailRecibido = {
  banco: Banco;
  recibido: string;
  asunto: string;
  guardadas: Array<{ titulo: string }>;
  descartadas: Array<{ titulo: string; motivo: string }>;
  error: string | null;
};

/** Los últimos correos de promos que llegaron por mail y qué se hizo con cada uno. */
export const ultimosMails = cache(async function ultimosMails(limite = 5): Promise<MailRecibido[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_ingestas")
    .select("banco, iniciada_en, detalle")
    .eq("detalle->>mail", "true")
    .order("iniciada_en", { ascending: false })
    .limit(limite);
  return (data ?? []).map((fila) => {
    const d = (fila.detalle ?? {}) as Partial<Omit<MailRecibido, "banco" | "recibido">>;
    return {
      banco: fila.banco,
      recibido: fila.iniciada_en,
      asunto: d.asunto ?? "",
      guardadas: d.guardadas ?? [],
      descartadas: d.descartadas ?? [],
      error: d.error ?? null,
    };
  });
});
