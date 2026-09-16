import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { env } from "@/lib/env";
import { CalendarLinkCard } from "./calendar-link-card";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function ConfigCalendarioPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const feedUrl = `${env.NEXT_PUBLIC_APP_URL}/api/calendar/${context.member.calendar_token}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Calendario externo" description="Suscribí los eventos de la familia en tu celular" />
      <CalendarLinkCard feedUrl={feedUrl} />
    </div>
  );
}
