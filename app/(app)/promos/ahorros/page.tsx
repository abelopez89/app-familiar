import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { addMonthsToDateOnly, dateOnlyToFamilyMidnightUtc, formatDate, todayInFamilyTimezone } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { diaMes } from "@/lib/promos/formato";
import { ventanaTope } from "@/lib/promos/ahorro";
import { estadoTopes } from "@/lib/promos/topes";
import { reintegrosPendientes, usosDePromos, usosEntre } from "@/lib/promos/usos";
import type { PromoUso } from "@/lib/supabase/types";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { ReintegroToggle } from "./reintegro-toggle";

const PERIODO = { dia: "del día", mes: "del mes", promo: "de la promo" } as const;

function enlaceUso(u: PromoUso): string {
  return u.shopping_list_id ? `/promos/usar?compra=${u.shopping_list_id}` : `/promos/usar?carga=${u.fuel_log_id}`;
}

/**
 * Ahorros del mes: lo que se descontó en caja y lo que se reintegra con
 * las promos registradas en compras y cargas de combustible, los
 * reintegros que faltan acreditar y cuánto se usó de cada tope por
 * tarjeta. `?mes=yyyy-MM` para mirar otro mes.
 */
export default async function AhorrosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");
  const familyId = context.family.id;

  const { mes: mesParam } = await searchParams;
  const hoy = todayInFamilyTimezone();
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hoy.slice(0, 7);
  const primerDia = `${mes}-01`;
  const ventana = ventanaTope("mes", primerDia)!;
  const fechaReferencia = hoy.startsWith(mes) ? hoy : ventana.hasta;

  const [usos, pendientes] = await Promise.all([
    usosEntre(familyId, ventana.desde, ventana.hasta),
    reintegrosPendientes(familyId),
  ]);
  const historicos = await usosDePromos(
    familyId,
    usos.flatMap((u) => (u.promo_id ? [u.promo_id] : [])),
  );
  const topes = estadoTopes(
    historicos.map((u) => ({ ...u, detalle: u.detalle as never })),
    fechaReferencia,
  ).filter((t) => t.periodo !== "promo" || t.usado > 0);

  const descuentoCaja = usos.reduce((s, u) => s + u.descuento_caja, 0);
  const reintegro = usos.reduce((s, u) => s + u.reintegro, 0);
  const modulo = MODULES_BY_KEY.promos;
  const anterior = addMonthsToDateOnly(primerDia, -1).slice(0, 7);
  const siguiente = addMonthsToDateOnly(primerDia, 1).slice(0, 7);

  return (
    <div className="flex flex-col gap-6 pb-nav">
      <PageHeader
        title="Ahorros con promos"
        description={formatDate(dateOnlyToFamilyMidnightUtc(primerDia), "MMMM yyyy")}
        icon={modulo.icon}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
        actions={
          <div className="flex gap-1">
            <Button asChild variant="outline" size="icon">
              <Link href={`/promos/ahorros?mes=${anterior}`} aria-label="Mes anterior">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon">
              <Link href={`/promos/ahorros?mes=${siguiente}`} aria-label="Mes siguiente">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total ahorrado" value={formatGuaranies(descuentoCaja + reintegro)} />
        <Stat label="En caja" value={formatGuaranies(descuentoCaja)} />
        <Stat label="Reintegros" value={formatGuaranies(reintegro)} />
      </div>

      {pendientes.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Reintegros por acreditar</SectionTitle>
          <Card className="gap-0 py-0">
            <CardContent className="flex flex-col divide-y p-0">
              {pendientes.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{u.promo_titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {diaMes(u.fecha)} · {u.tarjeta_alias} · {formatGuaranies(u.reintegro)}
                    </span>
                  </span>
                  <ReintegroToggle id={u.id} acreditado={u.reintegro_acreditado} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {topes.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Topes por tarjeta</SectionTitle>
          <Card className="gap-0 py-0">
            <CardContent className="flex flex-col divide-y p-0">
              {topes.map((t) => {
                const lleno = t.usado >= t.tope;
                return (
                  <div key={t.clave} className="flex flex-col gap-1 px-4 py-2 text-sm">
                    <span className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{t.promoTitulo}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{t.tarjetaAlias}</span>
                    </span>
                    <span className={cn("text-xs", lleno ? "font-medium text-warning" : "text-muted-foreground")}>
                      {t.topeTipo === "compra" ? "Compras" : t.tipo === "reintegro" ? "Reintegro" : "Descuento"}{" "}
                      {formatGuaranies(Math.min(t.usado, t.tope))} de {formatGuaranies(t.tope)}{" "}
                      {t.periodo ? PERIODO[t.periodo] : ""}
                      {lleno ? " · tope alcanzado" : ""}
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn("block h-full rounded-full", lleno ? "bg-warning" : "bg-mod-promos")}
                        style={{ width: `${Math.min(100, (t.usado / t.tope) * 100)}%` }}
                      />
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>Compras y cargas con promo</SectionTitle>
        {usos.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="Todavía no hay promos registradas este mes"
            description="Al cerrar una compra o cargar combustible, tocá «¿Pagaste con una promo de tarjeta?»."
          />
        ) : (
          <Card className="gap-0 py-0">
            <CardContent className="flex flex-col divide-y p-0">
              {usos.map((u) => (
                <Link key={u.id} href={enlaceUso(u)} className="flex flex-col gap-0.5 px-4 py-2 text-sm">
                  <span className="flex justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{u.promo_titulo}</span>
                    <span className="shrink-0 text-muted-foreground">{diaMes(u.fecha)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {u.shopping_list_id ? "Compra" : "Combustible"} · {u.tarjeta_alias} · {formatGuaranies(u.monto_bruto)}
                    {u.descuento_caja > 0 ? ` · caja −${formatGuaranies(u.descuento_caja)}` : ""}
                    {u.reintegro > 0
                      ? ` · reintegro −${formatGuaranies(u.reintegro)}${u.reintegro_acreditado ? " ✓" : ""}`
                      : ""}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
