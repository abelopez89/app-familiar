import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listActiveMembers, listEventsWithDetails } from "@/lib/events/queries";
import { CalendarView } from "./calendar-view";

export default async function EventosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [events, members] = await Promise.all([listEventsWithDetails(), listActiveMembers()]);

  return <CalendarView events={events} members={members} />;
}
