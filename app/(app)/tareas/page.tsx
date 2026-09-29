import { redirect } from "next/navigation";
import Link from "next/link";
import { ListChecks, Settings2, Wrench } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listAssets, listPendingInstancesWithDetails } from "@/lib/tasks/queries";
import { listActiveMembers } from "@/lib/members";
import { todayInFamilyTimezone } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { FloatingAction } from "@/components/app-shell/floating-action";
import { TasksList } from "./tasks-list";
import { DefinitionFormDialog } from "./definiciones/definition-form-dialog";

export default async function TareasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [instances, members, assets] = await Promise.all([
    listPendingInstancesWithDetails(),
    listActiveMembers(),
    listAssets(),
  ]);

  const { fg, bg } = MODULES_BY_KEY.tareas;

  return (
    <div className="flex flex-col gap-5 pb-20">
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
              <Link href="/tareas/definiciones" aria-label="Todas las tareas definidas">
                <Settings2 className="size-5" />
              </Link>
            </Button>
          </>
        }
      />

      <TasksList initialInstances={instances} members={members} today={todayInFamilyTimezone()} />

      {/*
       * Crear una tarea desde acá mismo. Antes solo se podía desde
       * /tareas/definiciones (el engranaje), y con el módulo fuera del
       * inicio no había forma de adivinarlo.
       */}
      <FloatingAction>
        <DefinitionFormDialog assets={assets} members={members} />
      </FloatingAction>
    </div>
  );
}
