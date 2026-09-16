import { redirect } from "next/navigation";
import Link from "next/link";
import { ListChecks, Settings2, Wrench } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listPendingInstancesWithDetails } from "@/lib/tasks/queries";
import { listActiveMembers } from "@/lib/members";
import { todayInFamilyTimezone } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { TasksList } from "./tasks-list";

export default async function TareasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [instances, members] = await Promise.all([
    listPendingInstancesWithDetails(),
    listActiveMembers(),
  ]);

  const { fg, bg } = MODULES_BY_KEY.tareas;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tareas"
        icon={ListChecks}
        iconFg={fg}
        iconBg={bg}
        actions={
          <>
            <Button asChild variant="ghost" size="icon" className="size-10">
              <Link href="/tareas/activos" aria-label="Activos del hogar">
                <Wrench className="size-5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="size-10">
              <Link href="/tareas/definiciones" aria-label="Definiciones de tareas">
                <Settings2 className="size-5" />
              </Link>
            </Button>
          </>
        }
      />

      <TasksList initialInstances={instances} members={members} today={todayInFamilyTimezone()} />
    </div>
  );
}
