import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { formatDateTime } from "@/lib/dates";
import { BANCOS } from "@/lib/promos/constants";
import { ultimosMails } from "@/lib/promos/queries";
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
  const mails = await ultimosMails();

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

      <section className="flex flex-col gap-2">
        <SectionTitle>Últimos mails recibidos</SectionTitle>
        {mails.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            Todavía no llegó ningún mail. Los newsletters de los bancos
            reenviados desde Gmail se leen y se guardan solos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 px-1 text-sm">
            {mails.map((m) => (
              <li key={m.recibido} className="flex flex-col">
                <span>
                  <span className="font-medium">{BANCOS[m.banco].label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatDateTime(m.recibido)}
                  </span>
                </span>
                <span className="text-muted-foreground">{m.asunto}</span>
                <span className="text-xs text-muted-foreground">
                  {m.error ? (
                    <span className="text-destructive">
                      No se pudo leer: {m.error}
                    </span>
                  ) : (
                    [
                      m.guardadas.length > 0
                        ? `Guardadas: ${m.guardadas.map((g) => g.titulo).join(", ")}`
                        : "Nada guardado",
                      ...m.descartadas.map((d) => `${d.titulo} (${d.motivo})`),
                    ].join(" · ")
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
