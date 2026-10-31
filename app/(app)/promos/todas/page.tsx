import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgePercent, CreditCard } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listActiveMembers } from "@/lib/members";
import { todayInFamilyTimezone } from "@/lib/dates";
import { BANCOS, RUBROS, type Rubro } from "@/lib/promos/constants";
import { comerciosVigentes, tarjetasQueAplican } from "@/lib/promos/matching";
import { describirComponente, describirDias, describirOrigen, describirTopes, diaMes, vencePronto } from "@/lib/promos/formato";
import { esBanco, nombreTarjeta } from "@/lib/promos/normalize";
import {
  listarPromosActivas,
  listarPromosDesactivadas,
  listarTarjetasActivas,
  type PromoConCapas,
} from "@/lib/promos/queries";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AccionesPromo } from "../acciones-promo";

type Filtros = { banco?: string; rubro?: string; mias?: string; estado?: string };

const RUBROS_ORDEN = Object.keys(RUBROS) as Rubro[];

/** La URL con un filtro cambiado (sin el valor, lo saca). */
function conFiltro(actual: Filtros, clave: keyof Filtros, valor: string | undefined): string {
  const params = new URLSearchParams();
  const nuevo = { ...actual, [clave]: valor };
  for (const [k, v] of Object.entries(nuevo)) if (v) params.set(k, v);
  const query = params.toString();
  return query ? `/promos/todas?${query}` : "/promos/todas";
}

function Chip({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      className={cn(
        "tap-target flex items-center rounded-full border px-3 text-sm whitespace-nowrap",
        activo ? "border-transparent bg-mod-promos-soft font-medium text-mod-promos" : "text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Todas las promos cargadas y vigentes, de todos los bancos, agrupadas por
 * rubro: qué días vale cada capa, a qué tarjetas de la familia les sirve
 * (o que no le sirve a ninguna) y de dónde salió. Las desactivadas se ven
 * aparte y se pueden reactivar. Los filtros van en la URL.
 */
export default async function TodasLasPromosPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const filtros = await searchParams;
  const desactivadas = filtros.estado === "desactivadas";
  const hoy = todayInFamilyTimezone();
  const [promos, tarjetas, members] = await Promise.all([
    desactivadas ? listarPromosDesactivadas(hoy) : listarPromosActivas(hoy),
    listarTarjetasActivas(),
    listActiveMembers(),
  ]);
  const modulo = MODULES_BY_KEY.promos;
  const nombreMiembro = new Map(members.map((m) => [m.id, m.display_name]));

  const filtradas = promos
    .map((promo) => ({ promo, aplican: tarjetasQueAplican(promo, tarjetas) }))
    .filter(({ promo, aplican }) => {
      if (filtros.banco && promo.banco !== filtros.banco) return false;
      if (filtros.rubro && promo.rubro !== filtros.rubro) return false;
      if (filtros.mias && aplican.length === 0) return false;
      return true;
    })
    .sort(
      (a, b) =>
        (b.aplican.length > 0 ? 1 : 0) - (a.aplican.length > 0 ? 1 : 0) ||
        (a.promo.vigencia_hasta ?? "9999").localeCompare(b.promo.vigencia_hasta ?? "9999"),
    );
  const porRubro = RUBROS_ORDEN.map((rubro) => ({
    rubro,
    items: filtradas.filter(({ promo }) => promo.rubro === rubro),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6 pb-nav">
      <PageHeader
        title="Todas las promos"
        description={`${filtradas.length} ${desactivadas ? "desactivada" : "vigente"}${filtradas.length === 1 ? "" : "s"}`}
        icon={modulo.icon}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
      />

      <div className="flex flex-col gap-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={conFiltro(filtros, "banco", undefined)} activo={!filtros.banco}>
            Todos los bancos
          </Chip>
          {Object.entries(BANCOS).map(([clave, banco]) => (
            <Chip key={clave} href={conFiltro(filtros, "banco", clave)} activo={filtros.banco === clave}>
              {banco.label}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={conFiltro(filtros, "rubro", undefined)} activo={!filtros.rubro}>
            Todos los rubros
          </Chip>
          {RUBROS_ORDEN.map((rubro) => (
            <Chip key={rubro} href={conFiltro(filtros, "rubro", rubro)} activo={filtros.rubro === rubro}>
              {RUBROS[rubro].emoji} {RUBROS[rubro].label}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={conFiltro(filtros, "mias", filtros.mias ? undefined : "1")} activo={!!filtros.mias}>
            Solo mis tarjetas
          </Chip>
          <Chip
            href={conFiltro(filtros, "estado", desactivadas ? undefined : "desactivadas")}
            activo={desactivadas}
          >
            Desactivadas
          </Chip>
        </div>
      </div>

      {porRubro.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title={desactivadas ? "No hay promos desactivadas" : "No hay promos con estos filtros"}
          description={desactivadas ? "Las que desactives desde la lista aparecen acá." : "Probá sacando algún filtro."}
        />
      ) : (
        porRubro.map(({ rubro, items }) => (
          <section key={rubro} className="flex flex-col gap-2">
            <SectionTitle>
              {RUBROS[rubro].emoji} {RUBROS[rubro].label}
            </SectionTitle>
            {items.map(({ promo, aplican }) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                aplican={aplican.map((t) => ({
                  id: t.id,
                  texto: `${t.alias} · ${nombreTarjeta(t)}${nombreMiembro.get(t.member_id) ? ` · ${nombreMiembro.get(t.member_id)}` : ""}`,
                }))}
                hoy={hoy}
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function PromoCard({
  promo,
  aplican,
  hoy,
}: {
  promo: PromoConCapas;
  aplican: Array<{ id: string; texto: string }>;
  hoy: string;
}) {
  const comercios = comerciosVigentes(promo.comercios, hoy).map((c) => c.comercio_nombre);
  const vence = vencePronto(promo.vigencia_hasta, hoy);
  const beneficios = [...promo.beneficios].sort((a, b) => a.prioridad - b.prioridad);

  return (
    <Card className={cn("gap-0 py-0", aplican.length === 0 && "opacity-75")}>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{comercios.length > 0 ? comercios.join(", ") : promo.titulo}</p>
            {promo.resumen && <p className="text-sm text-muted-foreground">{promo.resumen}</p>}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {esBanco(promo.banco) ? BANCOS[promo.banco].label : promo.banco}
          </Badge>
        </div>

        {beneficios.map((b, i) => {
          const topes = describirTopes(b.componentes);
          return (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-sm">
                {beneficios.length > 1 && <span className="font-medium">{b.nombre}: </span>}
                <span className="text-muted-foreground">{describirDias(b)}</span>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {b.componentes.map((c, j) => (
                  <li
                    key={j}
                    className="rounded-md bg-mod-promos-soft px-2 py-0.5 text-sm font-medium text-mod-promos"
                  >
                    {describirComponente(c)}
                  </li>
                ))}
              </ul>
              {topes.length > 0 && <p className="text-xs text-muted-foreground">{topes.join(" · ")}</p>}
            </div>
          );
        })}

        {aplican.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-sm">
            {aplican.map((t) => (
              <li key={t.id}>
                <CreditCard className="mr-1 inline size-3.5 align-[-2px] text-muted-foreground" />
                {t.texto}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No aplica a tus tarjetas</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {promo.vigencia_hasta ? (
            <span className={vence ? "font-medium text-warning" : undefined}>
              {vence ? "Vence pronto · " : ""}
              {promo.vigencia_desde && promo.vigencia_desde > hoy ? `desde ${diaMes(promo.vigencia_desde)} ` : ""}
              hasta {diaMes(promo.vigencia_hasta)}
            </span>
          ) : (
            <span>sin fecha de fin</span>
          )}
          {promo.canal && <span>{promo.canal}</span>}
          <span>origen: {describirOrigen(promo)}</span>
        </div>

        <AccionesPromo promo={promo} />
      </CardContent>
    </Card>
  );
}
