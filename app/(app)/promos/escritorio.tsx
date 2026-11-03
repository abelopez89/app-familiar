import Link from "next/link";
import { BadgePercent, CreditCard, FileUp, List, PiggyBank } from "lucide-react";
import type { FamilyMember } from "@/lib/supabase/types";
import { BANCOS, RUBROS, type Rubro } from "@/lib/promos/constants";
import { comerciosVigentes, porcentajeTotal, promosQueAplican } from "@/lib/promos/matching";
import { describirComponente, describirTopes, diaMes, vencePronto } from "@/lib/promos/formato";
import { esBanco, nombreTarjeta } from "@/lib/promos/normalize";
import { ventanaTope } from "@/lib/promos/ahorro";
import { estadoTopes } from "@/lib/promos/topes";
import { reintegrosPendientes, usosDePromos, usosEntre } from "@/lib/promos/usos";
import type { EstadoIngesta, PromoConCapas, listarTarjetasActivas } from "@/lib/promos/queries";
import { dateOnlyToFamilyMidnightUtc, formatDate, formatDateTime } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { AccionesPromo } from "./acciones-promo";
import { ActualizarButton } from "./actualizar-button";

export type PromosParams = { rubro?: string; banco?: string; tarjeta?: string };
type Tarjeta = Awaited<ReturnType<typeof listarTarjetasActivas>>[number];

const BANCOS_CON_ESTADO = ["itau", "gnb"] as const;

function hrefWith(params: PromosParams, changes: Partial<PromosParams>): string {
  const next = { ...params, ...changes };
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) search.set(k, v);
  const qs = search.toString();
  return qs ? `/promos?${qs}` : "/promos";
}

/**
 * Promos de hoy en escritorio (`lg:`): filtros a la izquierda (rubro, banco
 * y tarjeta, como parámetros de la URL), las promos de hoy en grilla al
 * centro y a la derecha el resumen de ahorros del mes, los topes por
 * tarjeta y el estado de la ingesta por banco. Mismo matching que el
 * celular (`promosQueAplican` sobre las tarjetas de la familia, o sobre la
 * tarjeta elegida) y la misma cuenta de ahorros que `/promos/ahorros`. Lo
 * único de cliente es lo que la vista del celular ya carga (acciones de
 * cada promo y "Actualizar ahora").
 */
export async function PromosEscritorio({
  familyId,
  hoy,
  promos,
  tarjetas,
  members,
  ingestas,
  params,
}: {
  familyId: string;
  hoy: string;
  promos: PromoConCapas[];
  tarjetas: Tarjeta[];
  members: FamilyMember[];
  ingestas: EstadoIngesta[];
  params: PromosParams;
}) {
  const nombreMiembro = new Map(members.map((m) => [m.id, m.display_name]));
  const tarjetaElegida = params.tarjeta ? tarjetas.find((t) => t.id === params.tarjeta) : undefined;
  // Con una tarjeta elegida se calcula contra esa sola: con todas,
  // `promosQueAplican` se queda con la mejor de la familia y una promo que
  // también le sirve a la elegida podría figurar con otra.
  const base = promosQueAplican(promos, tarjetaElegida ? [tarjetaElegida] : tarjetas, hoy).sort((a, b) => {
    const va = vencePronto(a.promo.vigencia_hasta, hoy) ? 1 : 0;
    const vb = vencePronto(b.promo.vigencia_hasta, hoy) ? 1 : 0;
    return vb - va || porcentajeTotal(b.beneficio) - porcentajeTotal(a.beneficio);
  });
  const matches = base.filter(
    (m) => (!params.rubro || m.promo.rubro === params.rubro) && (!params.banco || m.promo.banco === params.banco),
  );
  const rubros = Object.keys(RUBROS) as Rubro[];
  const bancos = [...new Set(base.map((m) => m.promo.banco))].sort();
  const modulo = MODULES_BY_KEY.promos;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promos de hoy"
        description={formatDate(dateOnlyToFamilyMidnightUtc(hoy), "EEEE d 'de' MMMM")}
        icon={modulo.icon}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/promos/todas">
                <List className="size-4" />
                Todas las promos
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/config/tarjetas">
                <CreditCard className="size-4" />
                Mis tarjetas
              </Link>
            </Button>
            <Button asChild>
              <Link href="/promos/cargar">
                <FileUp className="size-4" />
                Cargar promo
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[10rem_minmax(0,1fr)_17rem] items-start gap-5 xl:grid-cols-[11rem_minmax(0,1fr)_19rem]">
        {/* Filtros */}
        <nav className="flex flex-col gap-5 text-sm" aria-label="Filtros">
          <Grupo titulo="Rubro">
            <Filtro href={hrefWith(params, { rubro: undefined })} active={!params.rubro} label="Todos" count={base.length} />
            {rubros.map((r) => (
              <Filtro
                key={r}
                href={hrefWith(params, { rubro: r })}
                active={params.rubro === r}
                label={`${RUBROS[r].emoji} ${RUBROS[r].label}`}
                count={base.filter((m) => m.promo.rubro === r).length}
              />
            ))}
          </Grupo>
          {bancos.length > 0 && (
            <Grupo titulo="Banco">
              <Filtro href={hrefWith(params, { banco: undefined })} active={!params.banco} label="Todos" />
              {bancos.map((b) => (
                <Filtro
                  key={b}
                  href={hrefWith(params, { banco: b })}
                  active={params.banco === b}
                  label={esBanco(b) ? BANCOS[b].label : b}
                  count={base.filter((m) => m.promo.banco === b).length}
                />
              ))}
            </Grupo>
          )}
          {tarjetas.length > 0 && (
            <Grupo titulo="Tarjeta">
              <Filtro href={hrefWith(params, { tarjeta: undefined })} active={!params.tarjeta} label="Todas" />
              {tarjetas.map((t) => (
                <Filtro key={t.id} href={hrefWith(params, { tarjeta: t.id })} active={params.tarjeta === t.id} label={t.alias} />
              ))}
            </Grupo>
          )}
        </nav>

        {/* Promos */}
        <div className="min-w-0">
          {tarjetas.length === 0 ? (
            <Vacio>
              Cargá las tarjetas de la familia en{" "}
              <Link href="/config/tarjetas" className="font-medium text-foreground underline-offset-2 hover:underline">
                Mis tarjetas
              </Link>
              : las promos se filtran por las tarjetas que tiene cada uno.
            </Vacio>
          ) : matches.length === 0 ? (
            <Vacio>Hoy no hay promos para {tarjetaElegida ? "esa tarjeta" : "tus tarjetas"} con esos filtros.</Vacio>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {matches.map(({ promo, tarjeta, beneficio }) => {
                const comercios = comerciosVigentes(promo.comercios, hoy).map((c) => c.comercio_nombre);
                const vence = vencePronto(promo.vigencia_hasta, hoy);
                const topes = describirTopes(beneficio.componentes);
                const duenio = nombreMiembro.get(tarjeta.member_id);
                const rubro = RUBROS[promo.rubro as Rubro];
                return (
                  <article key={promo.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {rubro ? `${rubro.emoji} ${rubro.label}` : promo.rubro}
                        </p>
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
                        <li key={i} className="rounded-md bg-mod-promos-soft px-2 py-0.5 text-sm font-medium text-mod-promos">
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
                    <div className="mt-auto">
                      <AccionesPromo promo={promo} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Ahorros, topes e ingestas */}
        <aside className="flex flex-col gap-4">
          <Ahorros familyId={familyId} hoy={hoy} />
          <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-xs text-muted-foreground shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Actualización</h2>
            {BANCOS_CON_ESTADO.map((banco) => {
              const estado = ingestas.find((e) => e.banco === banco);
              return (
                <p key={banco}>
                  <span className="font-medium text-foreground">{BANCOS[banco].label}</span>:{" "}
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
            <div>
              <ActualizarButton enCurso={ingestas.find((e) => e.banco === "itau")?.enCurso ?? false} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Mismo cálculo que `/promos/ahorros` para el mes en curso. */
async function Ahorros({ familyId, hoy }: { familyId: string; hoy: string }) {
  const ventana = ventanaTope("mes", hoy)!;
  const [usos, pendientes] = await Promise.all([usosEntre(familyId, ventana.desde, ventana.hasta), reintegrosPendientes(familyId)]);
  const historicos = await usosDePromos(familyId, usos.flatMap((u) => (u.promo_id ? [u.promo_id] : [])));
  const topes = estadoTopes(
    historicos.map((u) => ({ ...u, detalle: u.detalle as never })),
    hoy,
  ).filter((t) => t.periodo !== "promo" || t.usado > 0);
  const descuentoCaja = usos.reduce((s, u) => s + u.descuento_caja, 0);
  const reintegro = usos.reduce((s, u) => s + u.reintegro, 0);
  const porAcreditar = pendientes.reduce((s, u) => s + u.reintegro, 0);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <PiggyBank className="size-4 text-mod-promos" />
          Ahorros de {formatDate(dateOnlyToFamilyMidnightUtc(ventana.desde), "MMMM")}
        </h2>
        <Link href="/promos/ahorros" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Ver →
        </Link>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-success">{formatGuaranies(descuentoCaja + reintegro)}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">En caja</dt>
          <dd className="font-medium tabular-nums">{formatGuaranies(descuentoCaja)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reintegros</dt>
          <dd className="font-medium tabular-nums">{formatGuaranies(reintegro)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Por acreditar (cualquier mes)</dt>
          <dd className="font-medium tabular-nums">
            {formatGuaranies(porAcreditar)}
            {pendientes.length > 0 ? ` · ${pendientes.length} ${pendientes.length === 1 ? "reintegro" : "reintegros"}` : ""}
          </dd>
        </div>
      </dl>
      {topes.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Topes por tarjeta</p>
          {topes.slice(0, 6).map((t) => {
            const lleno = t.usado >= t.tope;
            return (
              <div key={t.clave} className="flex flex-col gap-1 text-xs">
                <span className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{t.promoTitulo}</span>
                  <span className="shrink-0 text-muted-foreground">{t.tarjetaAlias}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", lleno ? "bg-warning" : "bg-mod-promos")}
                    style={{ width: `${Math.min(100, (t.usado / t.tope) * 100)}%` }}
                  />
                </span>
                <span className={cn("tabular-nums", lleno ? "font-medium text-warning" : "text-muted-foreground")}>
                  {formatGuaranies(Math.min(t.usado, t.tope))} de {formatGuaranies(t.tope)}
                  {lleno ? " · tope alcanzado" : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</p>
      {children}
    </div>
  );
}

function Filtro({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg px-2.5 transition-colors",
        active ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Link>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
      <BadgePercent className="size-6" />
      <span>{children}</span>
    </p>
  );
}
