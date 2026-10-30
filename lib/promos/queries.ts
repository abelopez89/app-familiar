import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import type { Banco } from "./constants";
import type { PromoParaMatch } from "./matching";

/**
 * Lecturas de la pantalla de promos, con el cliente de sesión: las promos
 * son de lectura para cualquier autenticado (migración 014) y las tarjetas
 * las filtra RLS por familia (además del `.eq` explícito).
 */

const SELECT_PROMO = `
  id, banco, titulo, resumen, rubro, vigencia_desde, vigencia_hasta, canal, activa,
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
  comercios: Array<{ comercio_nombre: string; desde: string | null; hasta: string | null }>;
  beneficios: Array<PromoParaMatch["beneficios"][number] & { nombre: string }>;
};

/**
 * Promos activas que no vencieron antes de `desde`. La vigencia inicial y
 * los días se resuelven en `matching.ts`, no en la consulta.
 */
export const listarPromosActivas = cache(async function listarPromosActivas(desde: string): Promise<PromoConCapas[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promociones")
    .select(SELECT_PROMO)
    .eq("activa", true)
    .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${desde}`);
  if (error) {
    console.error("[listarPromosActivas]", error);
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
});

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

export type EstadoIngesta = { banco: Banco; ultimaOk: string | null; ultimaFallo: boolean };

/** Última ingesta OK por banco, y si la última de todas falló. */
export const estadoIngestas = cache(async function estadoIngestas(): Promise<EstadoIngesta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_ingestas")
    .select("banco, ok, terminada_en, iniciada_en")
    .order("iniciada_en", { ascending: false })
    .limit(60);

  const porBanco = new Map<Banco, EstadoIngesta>();
  for (const fila of data ?? []) {
    const estado = porBanco.get(fila.banco) ?? { banco: fila.banco, ultimaOk: null, ultimaFallo: false };
    if (!porBanco.has(fila.banco)) estado.ultimaFallo = !fila.ok && fila.terminada_en !== null;
    if (fila.ok && !estado.ultimaOk) estado.ultimaOk = fila.terminada_en;
    porBanco.set(fila.banco, estado);
  }
  return [...porBanco.values()];
});
