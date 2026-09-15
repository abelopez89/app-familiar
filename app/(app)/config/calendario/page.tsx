import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { env } from "@/lib/env";
import { CalendarLinkCard } from "./calendar-link-card";

export default async function ConfigCalendarioPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const feedUrl = `${env.NEXT_PUBLIC_APP_URL}/api/calendar/${context.member.calendar_token}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Calendario</h1>
      <CalendarLinkCard feedUrl={feedUrl} />
    </div>
  );
}
