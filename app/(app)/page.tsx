import { Suspense } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  FilePlus2,
  Fuel,
  ListChecks,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle } from "@/components/app-shell/page-header";
import { ModuleTile } from "@/components/app-shell/module-tile";
import { SelloDelDia } from "@/components/app-shell/nanduti";
import { LAUNCHER_MODULES, MODULES_BY_KEY, type ModuleKey } from "@/components/app-shell/modules";
import { FEATURES } from "@/lib/features";
import { getCurrentFamilyContext } from "@/lib/family";
import { isPhoneRequest } from "@/lib/device";
import { Tablero } from "./_tablero/tablero";
import { getOpenShoppingList } from "@/lib/shopping/queries";
import { shoppingListHref } from "@/lib/shopping/links";
import type { ShoppingList } from "@/lib/supabase/types";
import { listEventsWithDetails } from "@/lib/events/queries";
import { listActiveMembers } from "@/lib/members";
import { buildDisplayEvents } from "@/lib/events/view-model";
import { EVENT_CATEGORIES } from "@/lib/events/constants";
import { listPendingInstancesWithDetails } from "@/lib/tasks/queries";
import { listExpiringDocuments } from "@/lib/documents/queries";
import {
  addDaysToDateOnly,
  dateOnlyInFamilyTimezone,
  dateOnlyToFamilyMidnightUtc,
  formatDate,
  formatTime,
  hourInFamilyTimezone,
  todayInFamilyTimezone,
} from "@/lib/dates";

/**
 * Inicio.
 *
 * Es un lanzador, no un tablero: arriba, un acceso directo por
 * funcionalidad, que es lo primero que se toca al abrir la app; abajo,
 * el resumen del día, que es lo que se lee cuando ya estás adentro. El
 * orden importa — cuando el resumen ocupaba toda la pantalla, llegar a
 * combustible o documentos costaba pasar por la pestaña "Más".
 *
 * Las dos mitades se transmiten por separado (`Suspense`): la grilla se
 * pinta con su forma final apenas llega el HTML y los números caen
 * encima sin mover nada de lugar, en vez de dejar la pantalla en blanco
 * hasta que responden las cinco consultas.
 */
export default async function InicioPage() {
  const [context, isPhone] = await Promise.all([getCurrentFamilyContext(), isPhoneRequest()]);
  const hour = hourInFamilyTimezone();
  const saludo = hour < 6 ? "Buenas noches" : hour < 12 ? "Buen día" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const nombre = context?.member.display_name?.split(" ")[0];

  const lanzador = (
    <Lanzador saludo={saludo} nombre={nombre} familyName={context?.family.name} today={todayInFamilyTimezone()} />
  );

  // Panel web (escritorio): el tablero solo se arma si el pedido no viene
  // de un teléfono, así el celular no paga sus consultas ni su HTML. En
  // una computadora (o un iPad) van las dos vistas y el ancho decide con
  // `lg:`, para que achicar la ventana siga mostrando lo correcto.
  if (isPhone) return lanzador;

  return (
    <>
      <div className="lg:hidden">{lanzador}</div>
      <div className="hidden lg:block">
        <Tablero saludo={saludo} nombre={nombre ?? context?.family.name ?? "Tu familia"} today={todayInFamilyTimezone()} />
      </div>
    </>
  );
}

/** El inicio del celular (y de cualquier ventana angosta): el lanzador de siempre. */
function Lanzador({
  saludo,
  nombre,
  familyName,
  today,
}: {
  saludo: string;
  nombre?: string;
  familyName?: string;
  today: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/*
       * Encabezado de marca: el bloque verde con el sello de ñandutí es lo
       * único llamativo de la app (identidad "Lapacho y tereré"); todo lo
       * de abajo queda tranquilo. Es solo saludo y fecha: sin datos, para
       * no volver a convertir el inicio en un tablero (Fase Extra).
       */}
      <header className="relative overflow-hidden rounded-[1.75rem] bg-brand px-6 pt-6 pb-7 text-brand-foreground">
        <SelloDelDia
          today={today}
          className="absolute -top-3 -right-10 size-44 text-brand-line"
          discClassName="size-20 text-[2.5rem]"
        />
        <p className="text-sm text-brand-muted">{familyName ?? "Tu familia"}</p>
        <h1 className="mt-1.5 max-w-[58%] text-[2.25rem] leading-none font-bold tracking-tight">
          {nombre ? `${saludo}, ${nombre}` : saludo}
        </h1>
        <p className="mt-3 text-sm text-brand-muted first-letter:uppercase">
          {formatDate(dateOnlyToFamilyMidnightUtc(today), "EEEE d 'de' MMMM")}
        </p>
      </header>

      <nav aria-label="Módulos">
        <Suspense fallback={<ModuleGrid />}>
          <ModuleGridWithBadges />
        </Suspense>
      </nav>

      <Suspense fallback={<QuickActions />}>
        <QuickActionsWithList />
      </Suspense>

      <Suspense fallback={<ResumenSkeleton />}>
        <Resumen />
      </Suspense>
    </div>
  );
}

/*
 * Acciones rápidas: crear, no navegar (salvo "Mi lista", ver abajo). Las cuatro cosas que uno abre la
 * app para hacer de parado — la lista del súper, un evento, la carga de
 * nafta en la estación y la foto de un documento. "Cargar combustible"
 * está acá y no como dato en el resumen a propósito: cargar nafta no
 * vence ni se programa, no hay nada que listar (ver Fase 4).
 */
const QUICK_ACTIONS = [
  { href: "/compras/nueva", label: "Lista", icon: ShoppingCart },
  { href: "/eventos?nuevo=1", label: "Evento", icon: CalendarPlus },
  { href: "/combustible/nueva", label: "Nafta", icon: Fuel },
  { href: "/documentos/nuevo", label: "Documento", icon: FilePlus2 },
];

/*
 * Con una lista abierta, "Lista" lleva a esa lista (al modo supermercado si
 * la compra ya está en curso) en vez de crear otra: agregar un producto y
 * tildar en el súper son las tareas más frecuentes, y antes este botón
 * armaba una lista nueva al lado de la abierta. Crear otra sigue a un toque
 * desde Compras. Sin lista abierta (o mientras carga) es "crear lista".
 */
async function QuickActionsWithList() {
  const openList = await getOpenShoppingList();
  return <QuickActions openList={openList} />;
}

function QuickActions({ openList }: { openList?: Pick<ShoppingList, "id" | "status"> | null }) {
  const actions = QUICK_ACTIONS.map((action) =>
    openList && action.href === "/compras/nueva"
      ? { ...action, href: shoppingListHref(openList), label: "Mi lista" }
      : action,
  );
  return (
    <section aria-label="Acciones rápidas" className="grid grid-cols-2 gap-2">
      {actions.map(({ href, label, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="flex min-h-12 items-center gap-2.5 rounded-2xl bg-card px-4 text-sm font-bold transition-transform duration-150 active:scale-[0.97]"
        >
          <Icon className="size-5 shrink-0 text-primary" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </section>
  );
}

/** Grilla sin contadores: es también el fallback mientras cargan. */
function ModuleGrid({ badges }: { badges?: Partial<Record<ModuleKey, { count: number; tone: "default" | "alert"; hint?: string }>> }) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-4">
      {LAUNCHER_MODULES.map((module) => {
        const badge = badges?.[module.key];
        return (
          <ModuleTile
            key={module.key}
            module={module}
            badge={badge?.count}
            badgeTone={badge?.tone}
            hint={badge?.hint}
          />
        );
      })}
    </div>
  );
}

async function ModuleGridWithBadges() {
  const today = todayInFamilyTimezone();
  const weekEnd = addDaysToDateOnly(today, 6);

  const [openList, events, members, taskInstances, expiringDocuments] = await Promise.all([
    getOpenShoppingList(),
    listEventsWithDetails(),
    listActiveMembers(),
    // Con Tareas apagado (`lib/features.ts`) ni se consulta.
    FEATURES.tareas ? listPendingInstancesWithDetails() : Promise.resolve([]),
    listExpiringDocuments(),
  ]);

  const todayEvents = buildDisplayEvents(
    events,
    members,
    dateOnlyToFamilyMidnightUtc(today),
    dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, 1)),
  );
  const overdue = taskInstances.filter((i) => i.due_date < today).length;
  const thisWeek = taskInstances.filter((i) => i.due_date >= today && i.due_date <= weekEnd).length;

  return (
    <ModuleGrid
      badges={{
        compras: openList
          ? { count: 0, tone: "default", hint: openList.status === "en_curso" ? "Compra en curso" : "Lista abierta" }
          : undefined,
        eventos:
          todayEvents.length > 0
            ? {
                count: 0,
                tone: "default",
                hint: todayEvents.length === 1 ? "1 evento hoy" : `${todayEvents.length} eventos hoy`,
              }
            : undefined,
        tareas:
          overdue > 0
            ? { count: overdue, tone: "alert", hint: `${overdue} vencida${overdue === 1 ? "" : "s"}` }
            : thisWeek > 0
              ? { count: 0, tone: "default", hint: `${thisWeek} esta semana` }
              : undefined,
        documentos:
          expiringDocuments.length > 0
            ? { count: expiringDocuments.length, tone: "alert", hint: "Por vencer" }
            : undefined,
      }}
    />
  );
}

function ResumenSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Resumen de hoy</SectionTitle>
      <div className="h-32 animate-pulse hoja opacity-60" />
    </section>
  );
}

async function Resumen() {
  const today = todayInFamilyTimezone();
  const weekEnd = addDaysToDateOnly(today, 6);

  const [openList, events, members, taskInstances, expiringDocuments] = await Promise.all([
    getOpenShoppingList(),
    listEventsWithDetails(),
    listActiveMembers(),
    // Con Tareas apagado (`lib/features.ts`) ni se consulta.
    FEATURES.tareas ? listPendingInstancesWithDetails() : Promise.resolve([]),
    listExpiringDocuments(),
  ]);

  const todayAndTomorrow = buildDisplayEvents(
    events,
    members,
    dateOnlyToFamilyMidnightUtc(today),
    dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, 2)),
  );
  const membersById = new Map(members.map((m) => [m.id, m]));
  const dashboardTasks = taskInstances
    .filter((i) => i.due_date <= weekEnd)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const nadaQueMostrar =
    todayAndTomorrow.length === 0 &&
    dashboardTasks.length === 0 &&
    expiringDocuments.length === 0 &&
    !openList;

  if (nadaQueMostrar) {
    return (
      <section className="flex flex-col gap-3">
        <SectionTitle>Resumen de hoy</SectionTitle>
        <EmptyState
          icon={Sparkles}
          title="Todo al día"
          description={
            FEATURES.tareas
              ? "No hay eventos, tareas ni vencimientos pendientes para hoy."
              : "No hay eventos ni vencimientos pendientes para hoy."
          }
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Resumen de hoy</SectionTitle>

      {openList && (
        <Link
          href={shoppingListHref(openList)}
          className="flex items-center gap-3 rounded-[1.375rem] bg-card p-4 transition-transform duration-150 active:scale-[0.99]"
        >
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${MODULES_BY_KEY.compras.bg}`}>
            <ShoppingCart className={`size-5 ${MODULES_BY_KEY.compras.fg}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {openList.name ?? "Lista de compras"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {openList.status === "en_curso" ? "Compra en curso" : "Lista abierta"} ·{" "}
              {formatDate(openList.shopping_date)}
            </span>
          </span>
        </Link>
      )}

      {todayAndTomorrow.length > 0 && (
        <ResumenBloque
          modulo="eventos"
          icon={CalendarDays}
          titulo="Calendario"
          subtitulo="Hoy y mañana"
          href="/eventos"
          verMas="Ver calendario"
        >
          {todayAndTomorrow.map((event) => (
            <li key={event.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              {/*
               * El día va explícito arriba de la hora: con eventos de hoy y
               * de mañana mezclados, "18:00" sola no dice cuál es cuál. Un
               * evento de varios días que empezó antes cuenta como "Hoy".
               */}
              <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums">
                <span
                  className={`block font-bold ${dayLabel(event.starts_at, today) === "Hoy" ? "text-warning" : ""}`}
                >
                  {dayLabel(event.starts_at, today)}
                </span>
                <span className="block font-medium text-muted-foreground">
                  {event.all_day ? "Todo el día" : formatTime(event.starts_at)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{event.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {EVENT_CATEGORIES[event.category].label}
                  </Badge>
                  {event.participant_ids.map((id) => {
                    const member = membersById.get(id);
                    if (!member) return null;
                    return (
                      <span key={id} className="text-[11px] text-muted-foreground">
                        {member.display_name}
                      </span>
                    );
                  })}
                </span>
              </span>
            </li>
          ))}
        </ResumenBloque>
      )}

      {dashboardTasks.length > 0 && (
        <ResumenBloque
          modulo="tareas"
          icon={ListChecks}
          titulo="Tareas"
          subtitulo="Vencidas y de esta semana"
          href="/tareas"
          verMas="Ver tareas"
        >
          {dashboardTasks.map((instance) => {
            const vencida = instance.due_date < today;
            return (
              <li key={instance.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={`w-16 shrink-0 pt-0.5 text-xs font-medium tabular-nums ${
                    vencida ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {vencida ? "Vencida" : formatDate(instance.due_date)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {instance.definition.title}
                  </span>
                  {instance.assignedTo && (
                    <span className="block text-[11px] text-muted-foreground">
                      {instance.assignedTo.display_name}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ResumenBloque>
      )}

      {expiringDocuments.length > 0 && (
        <ResumenBloque
          modulo="documentos"
          icon={FilePlus2}
          titulo="Documentos"
          subtitulo="Por vencer"
          href="/documentos"
          verMas="Ver documentos"
        >
          {expiringDocuments.map((doc) => {
            const vencido = doc.expires_at! < today;
            return (
              <li key={doc.id}>
                <Link href={`/documentos/${doc.id}`} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`w-16 shrink-0 pt-0.5 text-xs font-medium tabular-nums ${
                      vencido ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {vencido ? "Vencido" : formatDate(doc.expires_at!)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</span>
                </Link>
              </li>
            );
          })}
        </ResumenBloque>
      )}
    </section>
  );
}

/** "Hoy", "Mañana" o la fecha, en la zona de la familia (nunca la del celular). */
function dayLabel(startsAt: string | Date, today: string): string {
  const day = dateOnlyInFamilyTimezone(startsAt);
  if (day <= today) return "Hoy";
  if (day === addDaysToDateOnly(today, 1)) return "Mañana";
  return formatDate(day, "EEE d");
}

function ResumenBloque({
  modulo,
  icon: Icon,
  titulo,
  subtitulo,
  href,
  verMas,
  children,
}: {
  modulo: ModuleKey;
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  subtitulo: string;
  href: string;
  verMas: string;
  children: React.ReactNode;
}) {
  const { fg, bg } = MODULES_BY_KEY[modulo];

  return (
    <div className="rounded-[1.375rem] bg-card p-5">
      <div className="flex items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`size-4.5 ${fg}`} />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg leading-tight font-bold">{titulo}</h3>
          <p className="text-xs text-muted-foreground">{subtitulo}</p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-border">{children}</ul>

      <Button asChild variant="ghost" size="sm" className="mt-2 w-full justify-center">
        <Link href={href}>{verMas}</Link>
      </Button>
    </div>
  );
}
