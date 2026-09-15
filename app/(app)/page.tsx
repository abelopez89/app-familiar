import Link from "next/link";
import { CalendarDays, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getOpenShoppingList } from "@/lib/shopping/queries";
import { listActiveMembers, listEventsWithDetails } from "@/lib/events/queries";
import { buildDisplayEvents } from "@/lib/events/view-model";
import { EVENT_CATEGORIES } from "@/lib/events/constants";
import {
  addDaysToDateOnly,
  dateOnlyToFamilyMidnightUtc,
  formatDate,
  formatTime,
  todayInFamilyTimezone,
} from "@/lib/dates";

export default async function HoyPage() {
  const [openList, events, members] = await Promise.all([
    getOpenShoppingList(),
    listEventsWithDetails(),
    listActiveMembers(),
  ]);

  const today = todayInFamilyTimezone();
  const from = dateOnlyToFamilyMidnightUtc(today);
  const to = dateOnlyToFamilyMidnightUtc(addDaysToDateOnly(today, 2));
  const todayAndTomorrow = buildDisplayEvents(events, members, from, to);
  const membersById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Hoy</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Eventos
          </CardTitle>
          <CardDescription>Hoy y mañana</CardDescription>
        </CardHeader>
        <CardContent>
          {todayAndTomorrow.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos para hoy ni mañana.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {todayAndTomorrow.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-14 shrink-0 text-xs text-muted-foreground">
                    {event.all_day ? "Todo el día" : formatTime(event.starts_at)}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{event.title}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/eventos">Ver calendario</Link>
          </Button>
        </CardContent>
      </Card>

      {openList ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5" />
              {openList.name ?? "Lista de compras"}
            </CardTitle>
            <CardDescription>
              {openList.status === "en_curso" ? "En curso" : "Abierta"} ·{" "}
              {formatDate(openList.shopping_date)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/compras/${openList.id}`}>Ver lista</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No tenés una lista de compras abierta</CardTitle>
            <CardDescription>
              Creá una nueva lista a partir de tus plantillas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/compras/nueva">Nueva lista de compras</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
