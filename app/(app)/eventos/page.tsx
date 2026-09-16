import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listEventsWithDetails } from "@/lib/events/queries";
import { listActiveMembers } from "@/lib/members";
import { CalendarView } from "./calendar-view";

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [events, members, params] = await Promise.all([
    listEventsWithDetails(),
    listActiveMembers(),
    searchParams,
  ]);

  // `?nuevo=1` llega desde el acceso rápido "Evento" del inicio.
  return <CalendarView events={events} members={members} abrirNuevo={params.nuevo === "1"} />;
}
