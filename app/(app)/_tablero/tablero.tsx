import { Suspense } from "react";
import Link from "next/link";
import { SelloDelDia } from "@/components/app-shell/nanduti";
import { CalendarPlus, FilePlus2, Fuel, ShoppingCart } from "lucide-react";
import { MODULES_BY_KEY, type ModuleKey } from "@/components/app-shell/modules";
import { EVENT_CATEGORY_CHIP } from "@/components/app-shell/event-chips";
import { PerformanceChart } from "@/app/(app)/combustible/[vehicleId]/performance-chart";
import { EVENT_CATEGORIES } from "@/lib/events/constants";
import { formatEfficiency } from "@/lib/fuel/efficiency";
import { balanceTone } from "@/lib/expenses/constants";
import { BalanceBars } from "@/app/(app)/gastos/balance-bars";
import { RUBROS, type Rubro } from "@/lib/promos/constants";
import { comerciosVigentes } from "@/lib/promos/matching";
import { describirComponente } from "@/lib/promos/formato";
import { formatGuaranies, formatQuantity } from "@/lib/format";
import { addDaysToDateOnly, dateOnlyInFamilyTimezone, dateOnlyToFamilyMidnightUtc, formatDate, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { shoppingListHref } from "@/lib/shopping/links";
import {
  DIAS_VENCIMIENTO,
  datosAhorro,
  datosCombustible,
  datosGastos,
  datosLista,
  datosPromos,
  datosSemana,
  datosVencimientos,
} from "./data";

/**
 * Inicio de escritorio (`lg:`, ≥ 1024px): un tablero. Es la excepción de
 * escritorio a "el inicio es un lanzador" (ver CLAUDE.md, "Panel web
 * (escritorio)"). El inicio no lo arma para un teléfono, así que el
 * celular no paga ninguna de estas consultas; todo es Server Component
 * (sin JS de cliente) y cada bloque va en su propio `Suspense`.
 */
export function Tablero({ saludo, nombre, today }: { saludo: string; nombre: string; today: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-5">
          {/* El sello de ñandutí: el único adorno de la pantalla. */}
          <SelloDelDia today={today} className="size-28 text-brand-line" discClassName="size-15 text-[1.75rem]" />
          <div className="min-w-0">
            <h1 className="text-[2.5rem] leading-none font-bold tracking-tight">
              {saludo}, {nombre}
            </h1>
            <p className="mt-2 text-base text-muted-foreground first-letter:uppercase">
              {formatDate(dateOnlyToFamilyMidnightUtc(today), "EEEE d 'de' MMMM")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {ACCESOS.map(({ href, label, icon: Icon, modulo }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-opacity hover:opacity-80",
                MODULES_BY_KEY[modulo].bg,
                MODULES_BY_KEY[modulo].fg,
              )}
            >
              <Icon className="size-4" />+ {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Suspense fallback={<Esqueleto className="h-28" />}>
          <IndicadorEventos />
        </Suspense>
        <Suspense fallback={<Esqueleto className="h-28" />}>
          <IndicadorDocumentos />
        </Suspense>
        <Suspense fallback={<Esqueleto className="h-28" />}>
          <IndicadorBalance />
        </Suspense>
        <Suspense fallback={<Esqueleto className="h-28" />}>
          <IndicadorAhorro />
        </Suspense>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Suspense fallback={<Esqueleto className="col-span-8 h-64" />}>
          <BloqueSemana />
        </Suspense>
        <Suspense fallback={<Esqueleto className="col-span-4 h-64" />}>
          <BloqueLista />
        </Suspense>
        <Suspense fallback={<Esqueleto className="col-span-8 h-72" />}>
          <BloqueCombustible />
        </Suspense>
        <Suspense fallback={<Esqueleto className="col-span-4 h-72" />}>
          <BloqueVencimientos />
        </Suspense>
        <Suspense fallback={<Esqueleto className="col-span-6 h-72" />}>
          <BloqueGastos />
        </Suspense>
        <Suspense fallback={<Esqueleto className="col-span-6 h-72" />}>
          <BloquePromos />
        </Suspense>
      </div>
    </div>
  );
}

const ACCESOS: { href: string; label: string; icon: typeof Fuel; modulo: ModuleKey }[] = [
  { href: "/compras/nueva", label: "Lista", icon: ShoppingCart, modulo: "compras" },
  { href: "/eventos?nuevo=1", label: "Evento", icon: CalendarPlus, modulo: "eventos" },
  { href: "/combustible/nueva", label: "Nafta", icon: Fuel, modulo: "combustible" },
  { href: "/documentos/nuevo", label: "Documento", icon: FilePlus2, modulo: "documentos" },
];

// ============ Piezas comunes ============

function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse hoja opacity-60", className)} />;
}

function Indicador({
  modulo,
  href,
  label,
  value,
  valueClassName,
  detail,
  detail2,
}: {
  modulo: ModuleKey;
  href: string;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  detail: React.ReactNode;
  /** Segunda línea opcional (el indicador de promos compara con el mes anterior). */
  detail2?: React.ReactNode;
}) {
  const { icon: Icon, fg, bg } = MODULES_BY_KEY[modulo];
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-2 hoja p-4 transition-colors hover:border-ring/40"
    >
      <span className="flex items-center gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-lg", bg)}>
          <Icon className={cn("size-4", fg)} />
        </span>
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      </span>
      <span className={cn("truncate text-2xl font-semibold tabular-nums", valueClassName)}>{value}</span>
      <span className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span className="truncate" title={typeof detail === "string" ? detail : undefined}>
          {detail}
        </span>
        {detail2 && (
          <span className="truncate" title={typeof detail2 === "string" ? detail2 : undefined}>
            {detail2}
          </span>
        )}
      </span>
    </Link>
  );
}

function Panel({
  modulo,
  title,
  subtitle,
  href,
  linkLabel,
  className,
  children,
}: {
  modulo: ModuleKey;
  title: string;
  subtitle?: React.ReactNode;
  href: string;
  linkLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { icon: Icon, fg, bg } = MODULES_BY_KEY[modulo];
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 hoja p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", bg)}>
            <Icon className={cn("size-4", fg)} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg leading-tight font-bold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <Link href={href} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
          {linkLabel} →
        </Link>
      </div>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** "Hoy", "Mañana" o el día, en la zona de la familia. */
function etiquetaDia(day: string, today: string): string {
  if (day <= today) return "Hoy";
  if (day === addDaysToDateOnly(today, 1)) return "Mañana";
  return formatDate(dateOnlyToFamilyMidnightUtc(day), "EEE d");
}

function miles(n: number): string {
  return Math.round(n).toLocaleString("es-PY");
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

// ============ Indicadores ============

async function IndicadorEventos() {
  const { today, total, next } = await datosSemana();
  return (
    <Indicador
      modulo="eventos"
      href="/eventos"
      label="Eventos esta semana"
      value={total}
      detail={
        next
          ? `Próximo: ${next.title} · ${etiquetaDia(dateOnlyInFamilyTimezone(next.starts_at), today)}${
              next.all_day ? "" : ` ${formatTime(next.starts_at)}`
            }`
          : "Nada en los próximos 7 días"
      }
    />
  );
}

async function IndicadorDocumentos() {
  const { docsSoon, docsExpired } = await datosVencimientos();
  return (
    <Indicador
      modulo="documentos"
      href="/documentos"
      label="Documentos por vencer"
      value={docsSoon}
      valueClassName={docsSoon > 0 ? "text-warning" : undefined}
      detail={`En ${DIAS_VENCIMIENTO} días${docsExpired > 0 ? ` · y ${plural(docsExpired, "vencido", "vencidos")}` : ""}`}
    />
  );
}

async function IndicadorBalance() {
  const data = await datosGastos();
  if (!data || data.myGroups === 0) {
    return (
      <Indicador
        modulo="gastos"
        href="/gastos"
        label="Tu balance en gastos"
        value="—"
        detail={data?.openCount ? "No participás de los grupos abiertos" : "Sin grupos abiertos"}
      />
    );
  }
  return (
    <Indicador
      modulo="gastos"
      href="/gastos"
      label="Tu balance en gastos"
      value={formatGuaranies(Math.abs(data.myTotal))}
      valueClassName={balanceTone(data.myTotal)}
      detail={
        data.allConsistent
          ? `${data.myTotal > 0 ? "Te deben" : data.myTotal < 0 ? "Debés" : "Al día"} en ${plural(data.myGroups, "grupo abierto", "grupos abiertos")}`
          : "Algún grupo no cierra: revisalo"
      }
    />
  );
}

async function IndicadorAhorro() {
  const data = await datosAhorro();
  return (
    <Indicador
      modulo="promos"
      href="/promos/ahorros"
      label={
        data ? `Descuentos de ${formatDate(dateOnlyToFamilyMidnightUtc(data.mes), "MMMM")}` : "Descuentos con promos"
      }
      value={formatGuaranies(data?.total ?? 0)}
      valueClassName="text-success"
      // Montos sin "Gs." en el detalle: el valor de arriba ya dice la moneda,
      // y con el prefijo las dos líneas no entraban a 1280px.
      detail={
        data
          ? data.usos === 0
            ? "Todavía sin promos este mes"
            : `Caja ${miles(data.caja)} · reintegros ${miles(data.reintegro)}`
          : "—"
      }
      detail2={
        data
          ? `${capitalizar(formatDate(dateOnlyToFamilyMidnightUtc(data.mesAnterior), "MMMM"))} ${miles(data.totalAnterior)} · a cobrar ${miles(data.porAcreditar)}`
          : undefined
      }
    />
  );
}

// ============ Bloques ============

async function BloqueSemana() {
  const { today, days, byDay } = await datosSemana();
  return (
    <Panel modulo="eventos" title="Esta semana" subtitle="Hoy y los 6 días siguientes" href="/eventos" linkLabel="Calendario" className="col-span-8">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const events = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            // Cada día abre el calendario de escritorio en ese día (con su
            // agenda), en vez de obligar a ir a Calendario y elegirlo.
            <Link
              key={day}
              href={`/eventos?mes=${day.slice(0, 7)}&dia=${day}`}
              className={cn(
                "flex min-h-40 min-w-0 flex-col gap-1.5 rounded-xl p-2 transition-colors",
                isToday ? "bg-accent ring-1 ring-primary/30 hover:bg-accent/80" : "bg-muted/60 hover:bg-muted",
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold capitalize",
                  isToday ? "text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {isToday ? "Hoy" : formatDate(dateOnlyToFamilyMidnightUtc(day), "EEE d")}
              </p>
              {events.slice(0, 4).map((e) => (
                <span
                  key={e.id}
                  title={`${e.title} · ${EVENT_CATEGORIES[e.category].label}`}
                  className={cn(
                    "flex flex-col rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight",
                    EVENT_CATEGORY_CHIP[e.category],
                  )}
                >
                  {!e.all_day && <span className="tabular-nums opacity-80">{formatTime(e.starts_at)}</span>}
                  <span className="line-clamp-2 hyphens-auto break-words">{e.title}</span>
                </span>
              ))}
              {events.length > 4 && (
                <span className="px-1 text-[11px] text-muted-foreground">+{events.length - 4} más</span>
              )}
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

async function BloqueLista() {
  const data = await datosLista();
  if (!data) {
    return (
      <Panel modulo="compras" title="Lista abierta" href="/compras" linkLabel="Compras" className="col-span-4">
        <Vacio>
          No hay ninguna lista abierta.{" "}
          <Link href="/compras/nueva" className="font-medium text-foreground underline-offset-2 hover:underline">
            Crear una
          </Link>
        </Vacio>
      </Panel>
    );
  }
  const { list, items } = data;
  const checked = items.filter((i) => i.is_checked).length;
  const missing = items.filter((i) => !i.is_checked);
  return (
    <Panel
      modulo="compras"
      title={list.name ?? "Lista abierta"}
      subtitle={list.status === "en_curso" ? "Compra en curso" : "Lista abierta"}
      href={shoppingListHref(list)}
      linkLabel="Abrir"
      className="col-span-4"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {checked} de {items.length} tildados
          </span>
          <span className="tabular-nums">{items.length > 0 ? Math.round((checked / items.length) * 100) : 0}%</span>
        </div>
        <span className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-mod-compras"
            style={{ width: `${items.length > 0 ? (checked / items.length) * 100 : 0}%` }}
          />
        </span>
      </div>
      {missing.length === 0 ? (
        <Vacio>{items.length === 0 ? "La lista está vacía." : "No falta nada."}</Vacio>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {missing.slice(0, 7).map((item) => (
            <li key={item.id} className="flex justify-between gap-2 py-1.5">
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 text-muted-foreground">{formatQuantity(item.quantity, item.unit)}</span>
            </li>
          ))}
          {missing.length > 7 && (
            <li className="py-1.5 text-xs text-muted-foreground">y {plural(missing.length - 7, "producto más", "productos más")}</li>
          )}
        </ul>
      )}
    </Panel>
  );
}

async function BloqueCombustible() {
  const data = await datosCombustible();
  if (!data.vehicle) {
    return (
      <Panel modulo="combustible" title="Rendimiento de combustible" href="/combustible/vehiculos" linkLabel="Vehículos" className="col-span-8">
        <Vacio>Todavía no hay vehículos cargados.</Vacio>
      </Panel>
    );
  }
  const { vehicle, unit, intervals, logDates, last, averageKmPerLiter, costPerKm, vehicleCount } = data;
  return (
    <Panel
      modulo="combustible"
      title={`Rendimiento · ${vehicle.name}`}
      subtitle={
        vehicleCount > 1
          ? `Último vehículo cargado · últimos ${plural(intervals.length, "tramo", "tramos")}`
          : `Últimos ${plural(intervals.length, "tramo", "tramos")} entre tanques llenos`
      }
      href={`/combustible/${vehicle.id}`}
      linkLabel="Detalle"
      className="col-span-8"
    >
      <div className="grid grid-cols-3 gap-4">
        <Dato label="Último tramo" value={last ? formatEfficiency(last.kmPerLiter, unit) : "—"} />
        <Dato label="Promedio" value={averageKmPerLiter ? formatEfficiency(averageKmPerLiter, unit) : "—"} />
        <Dato label="Costo por km" value={costPerKm ? formatGuaranies(costPerKm) : "—"} />
      </div>
      <PerformanceChart intervals={intervals} logDates={logDates} unit={unit} width={640} height={170} showAverage />
    </Panel>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

async function BloqueVencimientos() {
  const { items } = await datosVencimientos();
  return (
    <Panel
      modulo="documentos"
      title="Por vencer"
      subtitle={`Próximos ${DIAS_VENCIMIENTO} días`}
      href="/documentos"
      linkLabel="Documentos"
      className="col-span-4"
    >
      {items.length === 0 ? (
        <Vacio>Nada vence en los próximos {DIAS_VENCIMIENTO} días.</Vacio>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {items.slice(0, 7).map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <Link href={item.href} className="flex items-center justify-between gap-2 py-1.5 hover:text-foreground">
                <span className="min-w-0">
                  <span className="block truncate">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(item.date)}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium tabular-nums",
                    item.days < 0 ? "text-destructive" : item.days <= 7 ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {item.days < 0
                    ? `venció hace ${plural(-item.days, "día", "días")}`
                    : item.days === 0
                      ? "vence hoy"
                      : `en ${plural(item.days, "día", "días")}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function BloqueGastos() {
  const data = await datosGastos();
  const bundle = data?.latest;
  if (!bundle) {
    return (
      <Panel modulo="gastos" title="Gastos compartidos" href="/gastos" linkLabel="Gastos" className="col-span-6">
        <Vacio>No hay grupos abiertos.</Vacio>
      </Panel>
    );
  }
  return (
    <Panel
      modulo="gastos"
      title={bundle.group.name}
      subtitle={`Grupo abierto más reciente · total ${formatGuaranies(bundle.totalPyg)}`}
      href={`/gastos/${bundle.group.id}/balances`}
      linkLabel="Balances"
      className="col-span-6"
    >
      <BalanceBars bundle={bundle} />
    </Panel>
  );
}

async function BloquePromos() {
  const { hoy, hasCards, matches, members } = await datosPromos();
  const names = new Map(members.map((m) => [m.id, m.display_name]));
  return (
    <Panel
      modulo="promos"
      title="Promos de hoy"
      subtitle={hasCards ? plural(matches.length, "promo para tus tarjetas", "promos para tus tarjetas") : undefined}
      href="/promos"
      linkLabel="Ver todas"
      className="col-span-6"
    >
      {!hasCards ? (
        <Vacio>
          Cargá las tarjetas de la familia en{" "}
          <Link href="/config/tarjetas" className="font-medium text-foreground underline-offset-2 hover:underline">
            Mis tarjetas
          </Link>
          .
        </Vacio>
      ) : matches.length === 0 ? (
        <Vacio>Hoy no hay promos para tus tarjetas.</Vacio>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {matches.slice(0, 6).map(({ promo, tarjeta, beneficio }) => {
            const comercios = comerciosVigentes(promo.comercios, hoy).map((c) => c.comercio_nombre);
            const duenio = names.get(tarjeta.member_id);
            const rubro = RUBROS[promo.rubro as Rubro];
            return (
              <li key={promo.id} className="flex items-start gap-3 py-2">
                <span className="pt-0.5" title={rubro?.label}>
                  {rubro?.emoji ?? "🏷️"}
                </span>
                {/* El beneficio va en su propia línea, debajo del nombre, y
                    se corta a dos renglones: hay promos con varios
                    componentes y alcances ("20% en caja (perfumería…) + 10%
                    reintegro…") que, al costado, empujaban el nombre fuera
                    de la tarjeta. El texto completo queda en el `title`. */}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">
                    {comercios.length > 0 ? comercios.join(", ") : promo.titulo}
                  </span>
                  <span
                    title={beneficio.componentes.map(describirComponente).join(" + ")}
                    className="line-clamp-2 w-fit max-w-full rounded-full bg-mod-promos-soft px-2 py-0.5 text-xs font-medium text-mod-promos"
                  >
                    {beneficio.componentes.map(describirComponente).join(" + ")}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tarjeta.alias}
                    {duenio ? ` · ${duenio}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
