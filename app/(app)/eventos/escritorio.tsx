import Link from "next/link";
import { Bell, CalendarDays, Cake, ChevronLeft, ChevronRight, MapPin, Plus, Rss } from "lucide-react";
import type { EventWithDetails } from "@/lib/events/queries";
import type { FamilyMember } from "@/lib/supabase/types";
import { buildDisplayEvents, type DisplayEvent } from "@/lib/events/view-model";
import { EVENT_CATEGORIES, REMINDER_PRESETS } from "@/lib/events/constants";
import {
  addDaysToDateOnly,
  addMonthsToDateOnly,
  dateOnlyInFamilyTimezone,
  dateOnlyToFamilyMidnightUtc,
  dayOfWeekOfDateOnly,
  daysInMonthOfDateOnly,
  formatDate,
  formatTime,
  todayInFamilyTimezone,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { EVENT_CATEGORY_CHIP } from "@/components/app-shell/event-chips";
import { EventFormDialog } from "./event-form-dialog";

export type EventosParams = { mes?: string; dia?: string; nuevo?: string };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CHIPS_POR_DIA = 3;

/**
 * Celdas de la grilla mensual, de lunes a domingo, con los días del mes
 * anterior y del siguiente que completan las semanas. Aritmética de fecha
 * calendario (`yyyy-MM-dd`) de `lib/dates.ts`, nunca la zona del navegador
 * (misma cuenta que `month-grid.tsx`).
 */
function monthCells(monthStart: string): string[] {
  const firstWeekday = (dayOfWeekOfDateOnly(monthStart) + 6) % 7; // 0 = lunes
  const daysInMonth = daysInMonthOfDateOnly(monthStart);
  const [year, month] = monthStart.split("-");
  const cells: string[] = [];
  for (let i = firstWeekday; i > 0; i--) cells.push(addDaysToDateOnly(monthStart, -i));
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(addDaysToDateOnly(cells[cells.length - 1], 1));
  return cells;
}

function href(mes: string, dia: string): string {
  return `/eventos?mes=${mes.slice(0, 7)}&dia=${dia}`;
}

/** "1 día antes", "30 min antes"… del aviso por Telegram de un evento. */
function describeReminder(minutes: number): string {
  const preset = REMINDER_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  if (minutes % 1440 === 0) return `${minutes / 1440} días antes`;
  if (minutes % 60 === 0) return `${minutes / 60} h antes`;
  return `${minutes} min antes`;
}

/**
 * Calendario en escritorio (`lg:`): grilla mensual grande que empieza en
 * lunes, con chips por categoría, y a la derecha la agenda del día elegido
 * y el link al feed ICS. Mes y día van en la URL (`?mes=yyyy-MM&dia=…`) y
 * se resuelven en el servidor con `buildDisplayEvents`, así que no suma JS:
 * lo único de cliente es `EventFormDialog` ("Nuevo evento" y editar), que
 * la vista del celular ya carga.
 */
export function CalendarioEscritorio({
  events,
  members,
  params,
}: {
  events: EventWithDetails[];
  members: FamilyMember[];
  params: EventosParams;
}) {
  const today = todayInFamilyTimezone();
  const monthStart = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? `${params.mes}-01` : `${today.slice(0, 7)}-01`;
  const selected =
    /^\d{4}-\d{2}-\d{2}$/.test(params.dia ?? "") && params.dia!.startsWith(monthStart.slice(0, 7))
      ? params.dia!
      : today.startsWith(monthStart.slice(0, 7))
        ? today
        : monthStart;

  const cells = monthCells(monthStart);
  const display = buildDisplayEvents(
    events,
    members,
    dateOnlyToFamilyMidnightUtc(cells[0]),
    dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(cells[cells.length - 1], 1)),
  );
  const byDay = new Map<string, DisplayEvent[]>();
  for (const event of display) {
    const day = dateOnlyInFamilyTimezone(event.starts_at);
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  const dayEvents = byDay.get(selected) ?? [];
  const membersById = new Map(members.map((m) => [m.id, m]));
  const prev = addMonthsToDateOnly(monthStart, -1);
  const next = addMonthsToDateOnly(monthStart, 1);
  const { fg, bg } = MODULES_BY_KEY.eventos;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", bg)}>
            <CalendarDays className={cn("size-5.5", fg)} />
          </span>
          <h1 className="truncate text-[1.75rem] font-semibold tracking-tight first-letter:uppercase">
            {formatDate(dateOnlyToFamilyMidnightUtc(monthStart), "MMMM yyyy")}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={href(prev, prev)} aria-label="Mes anterior">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={href(today, today)}>Hoy</Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={href(next, next)} aria-label="Mes siguiente">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <EventFormDialog
            members={members}
            defaultDate={selected}
            defaultOpen={params.nuevo === "1"}
            trigger={
              <Button>
                <Plus className="size-4" />
                Nuevo evento
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_19rem] items-start gap-5">
        {/* Grilla mensual */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="grid grid-cols-7 border-b bg-muted/60">
            {WEEKDAYS.map((label) => (
              <div key={label} className="px-2 py-2 text-xs font-medium text-muted-foreground">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const inMonth = day.startsWith(monthStart.slice(0, 7));
              const isToday = day === today;
              const isSelected = day === selected;
              const events = byDay.get(day) ?? [];
              return (
                <Link
                  key={day}
                  href={href(day, day)}
                  scroll={false}
                  aria-current={isSelected ? "date" : undefined}
                  className={cn(
                    "flex min-h-28 min-w-0 flex-col gap-1 border-border p-1.5 transition-colors",
                    i % 7 !== 6 && "border-r",
                    i < cells.length - 7 && "border-b",
                    isSelected ? "bg-accent" : "hover:bg-muted/50",
                    !inMonth && !isSelected && "bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                      !inMonth && "text-muted-foreground/60",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {Number(day.slice(8, 10))}
                  </span>
                  {events.slice(0, CHIPS_POR_DIA).map((e) => (
                    <span
                      key={e.id}
                      title={`${e.all_day ? "" : `${formatTime(e.starts_at)} · `}${e.title} · ${EVENT_CATEGORIES[e.category].label}`}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight",
                        EVENT_CATEGORY_CHIP[e.category],
                        !inMonth && "opacity-60",
                      )}
                    >
                      {/* Con celdas de ~90px (1280px de ancho) la hora le
                          comía el título al chip: ahí va solo el título, y la
                          hora está en la agenda del día y en el `title`. */}
                      {!e.all_day && (
                        <span className="hidden tabular-nums opacity-80 min-[1400px]:inline">
                          {formatTime(e.starts_at)}{" "}
                        </span>
                      )}
                      {e.title}
                    </span>
                  ))}
                  {events.length > CHIPS_POR_DIA && (
                    <span className="px-1 text-[11px] text-muted-foreground">+{events.length - CHIPS_POR_DIA} más</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Agenda del día y feed ICS */}
        <aside className="sticky top-8 flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {selected === today ? "Hoy" : selected === addDaysToDateOnly(today, 1) ? "Mañana" : "Agenda del día"}
              </p>
              <h2 className="text-base font-semibold first-letter:uppercase">
                {formatDate(dateOnlyToFamilyMidnightUtc(selected), "EEEE d 'de' MMMM")}
              </h2>
            </div>
            {dayEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin eventos este día.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {dayEvents.map((e) => (
                  <li key={e.id}>
                    <AgendaItem display={e} members={members} membersById={membersById} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link
            href="/config/calendario"
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm transition-colors hover:border-ring/40"
          >
            <Rss className="size-4 shrink-0 text-mod-eventos" />
            <span className="min-w-0">
              <span className="block font-medium">Suscribirte desde tu calendario</span>
              <span className="block text-xs text-muted-foreground">Link del feed ICS para Google o Apple</span>
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function AgendaItem({
  display,
  members,
  membersById,
}: {
  display: DisplayEvent;
  members: FamilyMember[];
  membersById: Map<string, FamilyMember>;
}) {
  const participants = display.participant_ids.flatMap((id) => {
    const m = membersById.get(id);
    return m ? [m] : [];
  });
  const telegram = display.sourceEvent?.reminders.filter((r) => r.channel === "telegram") ?? [];
  const time = display.all_day
    ? "Todo el día"
    : `${formatTime(display.starts_at)}${display.ends_at ? `–${formatTime(display.ends_at)}` : ""}`;

  const content = (
    <span className="flex flex-col gap-1.5 py-2.5 text-left">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{time}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", EVENT_CATEGORY_CHIP[display.category])}>
          {EVENT_CATEGORIES[display.category].label}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {display.isBirthday && <Cake className="size-3.5 shrink-0 text-muted-foreground" />}
        {display.title}
      </span>
      {display.location && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          {display.location}
        </span>
      )}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {participants.length === 0 ? (
          <span>Toda la familia</span>
        ) : (
          participants.map((m) => (
            <span key={m.id} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.display_name}
            </span>
          ))
        )}
      </span>
      {!display.isBirthday && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bell className="size-3 shrink-0" />
          {telegram.length > 0
            ? `Aviso: ${telegram.map((r) => describeReminder(r.offset_minutes)).join(", ")}`
            : "Sin aviso"}
        </span>
      )}
    </span>
  );

  // Los cumpleaños salen de `birth_date`: no se editan desde acá.
  if (display.isBirthday || !display.sourceEvent) return content;

  return (
    <EventFormDialog
      members={members}
      event={display.sourceEvent}
      trigger={
        <button type="button" className="block w-full rounded-lg transition-colors hover:bg-muted/50">
          {content}
        </button>
      }
    />
  );
}
