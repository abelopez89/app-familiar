import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listEventsWithDetails } from "@/lib/events/queries";
import { listActiveMembers } from "@/lib/members";
import { CalendarView } from "./calendar-view";
import { isPhoneRequest } from "@/lib/device";
import { CalendarioEscritorio, type EventosParams } from "./escritorio";

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<EventosParams>;
}) {
  const [context, isPhone] = await Promise.all([getCurrentFamilyContext(), isPhoneRequest()]);
  if (!context) redirect("/login");

  const [events, members, params] = await Promise.all([
    listEventsWithDetails(),
    listActiveMembers(),
    searchParams,
  ]);

  // `?nuevo=1` llega desde el acceso rápido "Evento" del inicio.
  if (isPhone) return <CalendarView events={events} members={members} abrirNuevo={params.nuevo === "1"} />;

  // Panel web (escritorio): en una computadora van las dos vistas y el
  // ancho decide con `lg:`. El diálogo se abre por un portal, que el
  // `lg:hidden` del contenedor no oculta: con `?nuevo=1` lo abre solo la
  // vista de escritorio (si no, se abrirían dos).
  return (
    <>
      <div className="lg:hidden">
        <CalendarView events={events} members={members} />
      </div>
      <div className="hidden lg:block">
        <CalendarioEscritorio events={events} members={members} params={params} />
      </div>
    </>
  );
}
