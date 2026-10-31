import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgePercent, CreditCard, FileUp, List } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listActiveMembers } from "@/lib/members";
import { dateOnlyToFamilyMidnightUtc, formatDate, formatDateTime, todayInFamilyTimezone } from "@/lib/dates";
import { BANCOS, RUBROS, type Rubro } from "@/lib/promos/constants";
import { comerciosVigentes, porcentajeTotal, promosQueAplican } from "@/lib/promos/matching";
import { describirComponente, describirTopes, diaMes, vencePronto } from "@/lib/promos/formato";
import { esBanco, nombreTarjeta } from "@/lib/promos/normalize";
import { estadoIngestas, listarPromosActivas, listarTarjetasActivas } from "@/lib/promos/queries";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActualizarButton } from "./actualizar-button";
import { DesactivarButton } from "./desactivar-button";

// Alcanza para la ingesta que corre en `after()` desde "Actualizar ahora"
// (misma duración que la ruta del cron).
export const maxDuration = 300;

// Itaú se actualiza solo (o con "Actualizar ahora"); GNB, importando a
// mano el JSON en "Cargar promo" (rechaza los pedidos desde servidores).
// Sudameris y BASA no tienen línea: se cargan de a un PDF.
const BANCOS_CON_ESTADO = ["itau", "gnb"] as const;

/**
 * Promos de hoy: las promos activas que le sirven hoy a alguna tarjeta de
 * la familia (`promosQueAplican`), agrupadas por rubro. Las que vencen en
 * 7 días o menos van primero y marcadas. Abajo, la línea de estado de la
 * ingesta por banco, para notar si una fuente dejó de actualizarse.
 */
export default async function PromosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const hoy = todayInFamilyTimezone();
  const [promos, tarjetas, members, ingestas] = await Promise.all([
    listarPromosActivas(hoy),
    listarTarjetasActivas(),
    listActiveMembers(),
    estadoIngestas(),
  ]);
  const modulo = MODULES_BY_KEY.promos;
  const nombreMiembro = new Map(members.map((m) => [m.id, m.display_name]));

  const matches = promosQueAplican(promos, tarjetas, hoy).sort((a, b) => {
    const va = vencePronto(a.promo.vigencia_hasta, hoy) ? 1 : 0;
    const vb = vencePronto(b.promo.vigencia_hasta, hoy) ? 1 : 0;
    return vb - va || porcentajeTotal(b.beneficio) - porcentajeTotal(a.beneficio);
  });
  const porRubro = (Object.keys(RUBROS) as Rubro[])
    .map((rubro) => ({ rubro, items: matches.filter((m) => m.promo.rubro === rubro) }))
    .filter((g) => g.items.length > 0);

  const estadoPorBanco = new Map(ingestas.map((e) => [e.banco, e]));

  return (
    <div className="flex flex-col gap-6 pb-nav">
      <PageHeader
        title="Promos de hoy"
        description={formatDate(dateOnlyToFamilyMidnightUtc(hoy), "EEEE d 'de' MMMM")}
        icon={modulo.icon}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/promos/todas">
                <List className="size-4" />
                Todas
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/config/tarjetas">
                <CreditCard className="size-4" />
                Tarjetas
              </Link>
            </Button>
          </div>
        }
      />

      {tarjetas.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Cargá las tarjetas de la familia"
          description="Las promos se filtran por las tarjetas que tiene cada uno. No hace falta el número."
          action={
            <Button asChild>
              <Link href="/config/tarjetas">Ir a Mis tarjetas</Link>
            </Button>
          }
        />
      ) : porRubro.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title="Hoy no hay promos para tus tarjetas"
          description="Supermercado, farmacia, combustible y electrodomésticos, de los bancos de tus tarjetas."
        />
      ) : (
        porRubro.map(({ rubro, items }) => (
          <section key={rubro} className="flex flex-col gap-2">
            <SectionTitle>
              {RUBROS[rubro].emoji} {RUBROS[rubro].label}
            </SectionTitle>
            {items.map(({ promo, tarjeta, beneficio }) => {
              const comercios = comerciosVigentes(promo.comercios, hoy).map((c) => c.comercio_nombre);
              const vence = vencePronto(promo.vigencia_hasta, hoy);
              const topes = describirTopes(beneficio.componentes);
              const duenio = nombreMiembro.get(tarjeta.member_id);
              return (
                <Card key={promo.id} className="gap-0 py-0">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug">
                          {comercios.length > 0 ? comercios.join(", ") : promo.titulo}
                        </p>
                        {promo.resumen && <p className="text-sm text-muted-foreground">{promo.resumen}</p>}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {esBanco(promo.banco) ? BANCOS[promo.banco].label : promo.banco}
                      </Badge>
                    </div>

                    <ul className="flex flex-wrap gap-1.5">
                      {beneficio.componentes.map((c, i) => (
                        <li
                          key={i}
                          className="rounded-md bg-mod-promos-soft px-2 py-0.5 text-sm font-medium text-mod-promos"
                        >
                          {describirComponente(c)}
                        </li>
                      ))}
                    </ul>

                    <p className="text-sm">
                      <CreditCard className="mr-1 inline size-3.5 align-[-2px] text-muted-foreground" />
                      <span className="font-medium">{tarjeta.alias}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {nombreTarjeta(tarjeta)}
                        {duenio ? ` · ${duenio}` : ""}
                      </span>
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {topes.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                      {beneficio.nombre !== "General" && <span>{beneficio.nombre}</span>}
                      {promo.vigencia_hasta && (
                        <span className={vence ? "font-medium text-warning" : undefined}>
                          {vence ? "Vence pronto · " : ""}hasta {diaMes(promo.vigencia_hasta)}
                        </span>
                      )}
                    </div>
                    <DesactivarButton promoId={promo.id} titulo={promo.titulo} />
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ))
      )}

      <section className="flex flex-col gap-1 px-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <ActualizarButton enCurso={estadoPorBanco.get("itau")?.enCurso ?? false} />
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/promos/cargar">
              <FileUp className="size-4" />
              Cargar promo
            </Link>
          </Button>
        </div>
        {BANCOS_CON_ESTADO.map((banco) => {
          const estado = estadoPorBanco.get(banco);
          return (
            <p key={banco}>
              {BANCOS[banco].label}:{" "}
              {estado?.enCurso
                ? "actualizando…"
                : estado?.ultimaOk
                  ? `actualizado ${formatDateTime(estado.ultimaOk)}`
                  : "todavía sin actualizar"}
              {!estado?.enCurso && estado?.ultimaFallo && (
                <span className="text-destructive"> · la última actualización falló</span>
              )}
              {!estado?.enCurso && !!estado?.pendientes && ` · quedan ${estado.pendientes} por procesar`}
              {!estado?.enCurso && !!estado?.errores && !estado.ultimaFallo && ` · ${estado.errores} con error`}
            </p>
          );
        })}
      </section>
    </div>
  );
}
