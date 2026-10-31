import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CargarPromo } from "./cargar-promo";
import { ImportarGnb } from "./importar-gnb";

// Leer un PDF con Claude y normalizar una tanda de GNB tardan; las Server
// Actions de esta pantalla corren con el límite de la página.
export const maxDuration = 300;

/**
 * Cargar promo: lo que no se puede leer automáticamente. Sudameris y BASA
 * (bloquean o prohíben el acceso automatizado) por PDF o captura, y GNB
 * (rechaza los pedidos desde servidores) pegando el JSON de su API.
 */
export default async function CargarPromoPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");
  const modulo = MODULES_BY_KEY.promos;

  return (
    <div className="flex flex-col gap-6 pb-nav">
      <PageHeader
        title="Cargar promo"
        description="Sudameris, BASA y GNB"
        icon={modulo.icon}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
      />

      <section className="flex flex-col gap-2">
        <SectionTitle>Sudameris o BASA: PDF o captura</SectionTitle>
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <CargarPromo />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>GNB: importar el JSON</SectionTitle>
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <ImportarGnb />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
