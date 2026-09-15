import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings2, Wrench } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listActiveMembers, listPendingInstancesWithDetails } from "@/lib/tasks/queries";
import { todayInFamilyTimezone } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { TasksList } from "./tasks-list";

export default async function TareasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [instances, members] = await Promise.all([
    listPendingInstancesWithDetails(),
    listActiveMembers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tareas</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href="/tareas/activos" aria-label="Activos">
              <Wrench className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href="/tareas/definiciones" aria-label="Definiciones">
              <Settings2 className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <TasksList initialInstances={instances} members={members} today={todayInFamilyTimezone()} />
    </div>
  );
}
