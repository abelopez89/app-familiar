import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { leerReferencia, opcionesParaUso, usoDeReferencia } from "@/lib/promos/usos";
import { formatDate, dateOnlyToFamilyMidnightUtc } from "@/lib/dates";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader } from "@/components/app-shell/page-header";
import { UsarPromo } from "./usar-promo";

/**
 * "¿Pagaste con alguna promo?" para una compra cerrada (`?compra=<id>`) o
 * una carga de combustible (`?carga=<id>`): elegir promo y tarjeta, cargar
 * el monto bruto y ver cuánto deberían cobrar en caja y cuánto se
 * reintegra, con el tope que queda.
 */
export default async function UsarPromoPage({
  searchParams,
}: {
  searchParams: Promise<{ compra?: string; carga?: string }>;
}) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");
  const params = await searchParams;
  const ref = await leerReferencia(context.family.id, params);
  if (!ref) notFound();

  const [opciones, existente] = await Promise.all([
    opcionesParaUso(context.family.id, ref),
    usoDeReferencia(context.family.id, ref),
  ]);
  const modulo = MODULES_BY_KEY.promos;

  return (
    <div className="flex flex-col gap-6 pb-nav">
      <PageHeader
        title="¿Pagaste con promo?"
        description={`${ref.tipo === "compra" ? "Compra" : "Carga de combustible"} del ${formatDate(
          dateOnlyToFamilyMidnightUtc(ref.fecha),
          "EEEE d 'de' MMMM",
        )}${ref.comercio ? ` · ${ref.comercio}` : ""}`}
        icon={modulo.icon}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
      />
      <UsarPromo
        referencia={{ tipo: ref.tipo, id: ref.id, fecha: ref.fecha, volver: ref.volver }}
        montoInicial={existente?.monto_bruto ?? ref.monto}
        opciones={opciones}
        existente={
          existente
            ? {
                id: existente.id,
                clave: existente.promo_id && existente.tarjeta_id ? `${existente.promo_id}:${existente.tarjeta_id}` : null,
                titulo: existente.promo_titulo,
                tarjeta: existente.tarjeta_alias,
                claves: ((existente.detalle as { aplicados?: Array<{ clave: string }> } | null)?.aplicados ?? []).map(
                  (a) => a.clave,
                ),
              }
            : null
        }
      />
    </div>
  );
}
