import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PromoUso } from "@/lib/supabase/types";
import { dateOnlyInFamilyTimezone } from "@/lib/dates";
import type { Rubro } from "./constants";
import type { ComponenteConTope, DetalleUso, UsoAnterior } from "./ahorro";
import { beneficioDelDia, comerciosVigentes, porcentajeTotal } from "./matching";
import { nombreTarjeta, normalizarTexto } from "./normalize";
import { listarPromosActivas, listarTarjetasActivas, type PromoConCapas } from "./queries";

/**
 * Uso de promos en compras y combustible (migración 015). Lecturas con el
 * cliente de sesión: `promo_usos` es de la familia (RLS estándar) y las
 * promos se leen como en `/promos`. El cálculo es `lib/promos/ahorro.ts`.
 */

export type Referencia =
  | { tipo: "compra"; id: string; fecha: string; monto: number | null; comercio: string | null; volver: string }
  | { tipo: "carga"; id: string; fecha: string; monto: number | null; comercio: string | null; volver: string };

/** Rubros que se ofrecen según de dónde viene el gasto. */
export const RUBROS_POR_TIPO: Record<Referencia["tipo"], Rubro[]> = {
  compra: ["supermercado", "farmacia", "electrodomesticos"],
  carga: ["combustible"],
};

/** La compra cerrada o la carga de combustible, con su fecha en la zona de la familia. */
export async function leerReferencia(
  familyId: string,
  ref: { compra?: string; carga?: string },
): Promise<Referencia | null> {
  const supabase = await createClient();
  if (ref.compra) {
    const { data } = await supabase
      .from("shopping_lists")
      .select("id, shopping_date, closed_at, total_amount, store")
      .eq("id", ref.compra)
      .eq("family_id", familyId)
      .maybeSingle();
    if (!data) return null;
    return {
      tipo: "compra",
      id: data.id,
      fecha: data.closed_at ? dateOnlyInFamilyTimezone(data.closed_at) : data.shopping_date,
      monto: data.total_amount,
      comercio: data.store,
      volver: `/compras/${data.id}/comprar`,
    };
  }
  if (ref.carga) {
    const { data } = await supabase
      .from("fuel_logs")
      .select("id, vehicle_id, filled_at, total_amount, station")
      .eq("id", ref.carga)
      .eq("family_id", familyId)
      .maybeSingle();
    if (!data) return null;
    return {
      tipo: "carga",
      id: data.id,
      fecha: dateOnlyInFamilyTimezone(data.filled_at),
      monto: data.total_amount,
      comercio: data.station,
      volver: `/combustible/${data.vehicle_id}`,
    };
  }
  return null;
}

export type OpcionPromo = {
  /** `promoId:tarjetaId` */
  clave: string;
  promoId: string;
  titulo: string;
  banco: string;
  comercios: string[];
  tarjetaId: string;
  tarjetaAlias: string;
  tarjetaNombre: string;
  beneficio: string;
  componentes: ComponenteConTope[];
  usosAnteriores: UsoAnterior[];
};

function componentesConTope(beneficio: PromoConCapas["beneficios"][number]): ComponenteConTope[] {
  return beneficio.componentes.map((c) => ({ ...c, tope_tipo: c.tope_tipo ?? null }));
}

/**
 * Las promos que valían ese día para alguna tarjeta de la familia, una
 * opción por promo y tarjeta (cada tarjeta lleva su propio tope), del
 * rubro del gasto. Primero las del comercio cargado en la compra o la
 * carga, después por porcentaje.
 */
export async function opcionesParaUso(familyId: string, ref: Referencia): Promise<OpcionPromo[]> {
  const [promos, tarjetas] = await Promise.all([listarPromosActivas(ref.fecha), listarTarjetasActivas()]);
  const rubros = RUBROS_POR_TIPO[ref.tipo] as string[];

  const candidatas: Array<{ opcion: Omit<OpcionPromo, "usosAnteriores">; porcentaje: number; coincide: boolean }> = [];
  const comercio = ref.comercio ? normalizarTexto(ref.comercio) : null;
  for (const promo of promos) {
    if (!rubros.includes(promo.rubro)) continue;
    const comercios = comerciosVigentes(promo.comercios, ref.fecha).map((c) => c.comercio_nombre);
    const coincide =
      !!comercio && comercios.some((c) => normalizarTexto(c).includes(comercio) || comercio.includes(normalizarTexto(c)));
    for (const tarjeta of tarjetas) {
      const beneficio = beneficioDelDia(promo, tarjeta, ref.fecha);
      if (!beneficio) continue;
      candidatas.push({
        porcentaje: porcentajeTotal(beneficio),
        coincide,
        opcion: {
          clave: `${promo.id}:${tarjeta.id}`,
          promoId: promo.id,
          titulo: promo.titulo,
          banco: promo.banco,
          comercios,
          tarjetaId: tarjeta.id,
          tarjetaAlias: tarjeta.alias,
          tarjetaNombre: nombreTarjeta(tarjeta),
          beneficio: beneficio.nombre,
          componentes: componentesConTope(beneficio),
        },
      });
    }
  }
  candidatas.sort((a, b) => Number(b.coincide) - Number(a.coincide) || b.porcentaje - a.porcentaje);

  const usos = await usosDePromos(
    familyId,
    candidatas.map((c) => c.opcion.promoId),
  );
  return candidatas.map(({ opcion }) => ({
    ...opcion,
    usosAnteriores: usos
      .filter((u) => u.promo_id === opcion.promoId && u.tarjeta_id === opcion.tarjetaId)
      .map((u) => ({ id: u.id, fecha: u.fecha, detalle: u.detalle as Partial<DetalleUso> | null })),
  }));
}

/** Usos de la familia de esas promos (para los topes por tarjeta). */
export async function usosDePromos(familyId: string, promoIds: string[]): Promise<PromoUso[]> {
  if (promoIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_usos")
    .select("*")
    .eq("family_id", familyId)
    .in("promo_id", [...new Set(promoIds)]);
  return data ?? [];
}

export async function usoDeReferencia(familyId: string, ref: Referencia) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_usos")
    .select("*")
    .eq("family_id", familyId)
    .eq(ref.tipo === "compra" ? "shopping_list_id" : "fuel_log_id", ref.id)
    .maybeSingle();
  return data;
}

/** Los usos de promo de varias compras o cargas, por id de la compra o carga. */
export async function usosPorReferencia(
  familyId: string,
  columna: "shopping_list_id" | "fuel_log_id",
  ids: string[],
): Promise<Map<string, PromoUso>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("promo_usos").select("*").eq("family_id", familyId).in(columna, ids);
  return new Map((data ?? []).map((u) => [u[columna] as string, u]));
}

/** Usos de la familia entre dos fechas `yyyy-MM-dd` (inclusive), del más nuevo al más viejo. */
export async function usosEntre(familyId: string, desde: string, hasta: string): Promise<PromoUso[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_usos")
    .select("*")
    .eq("family_id", familyId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Reintegros todavía no acreditados, de cualquier mes. */
export async function reintegrosPendientes(familyId: string): Promise<PromoUso[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_usos")
    .select("*")
    .eq("family_id", familyId)
    .gt("reintegro", 0)
    .eq("reintegro_acreditado", false)
    .order("fecha");
  return data ?? [];
}
