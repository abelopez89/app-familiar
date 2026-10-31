import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { BANCOS } from "@/lib/promos/constants";
import { esBanco } from "@/lib/promos/normalize";
import { obtenerPromoParaEditar } from "@/lib/promos/queries";
import type { PromoFiltrada } from "@/lib/promos/filtrado";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader } from "@/components/app-shell/page-header";
import { EditarPromo } from "./editar-promo";

/**
 * Corregir una promo ya guardada (de cualquier origen) con el mismo editor
 * de la carga manual: rubro, vigencia, comercios, capas, días, descuentos,
 * topes y reglas de tarjetas.
 */
export default async function EditarPromoPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const datos = await obtenerPromoParaEditar(id);
  if (!datos) notFound();
  const modulo = MODULES_BY_KEY.promos;

  return (
    <div className="flex flex-col gap-6 pb-nav">
      <PageHeader
        title="Editar promo"
        description={esBanco(datos.banco) ? BANCOS[datos.banco].label : datos.banco}
        icon={modulo.icon}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
      />
      <EditarPromo
        id={datos.id}
        promo={datos.promo as PromoFiltrada}
        archivo={datos.archivo_path ? `/promos/${datos.id}/archivo` : null}
        activa={datos.activa}
      />
    </div>
  );
}
