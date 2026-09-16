import { redirect } from "next/navigation";
import { ListTodo } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listAssets, listTaskDefinitions } from "@/lib/tasks/queries";
import { listActiveMembers } from "@/lib/members";
import { formatDate } from "@/lib/dates";
import { RECURRENCE_UNIT_LABELS } from "@/lib/tasks/constants";
import { EmptyState } from "@/components/ui/empty-state";
import { NavGroup, NavRow } from "@/components/ui/nav-row";
import { PageHeader } from "@/components/app-shell/page-header";
import { DefinitionFormDialog } from "./definition-form-dialog";
import { FloatingAction } from "@/components/app-shell/floating-action";

export default async function DefinicionesPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [definitions, assets, members] = await Promise.all([
    listTaskDefinitions(),
    listAssets(),
    listActiveMembers(),
  ]);

  const membersById = new Map(members.map((m) => [m.id, m]));
  const assetsById = new Map(assets.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-5 pb-20">
      <PageHeader title="Definiciones" description="Qué se hace en la casa y cada cuánto" />

      {definitions.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Todavía no definiste ninguna tarea"
          description="Definí una vez cada cuánto se hace algo y la app genera el vencimiento sola."
        />
      ) : (
        <NavGroup>
          {definitions.map((definition) => {
            const asset = definition.asset_id ? assetsById.get(definition.asset_id) : null;
            const assignedTo = definition.assigned_to
              ? membersById.get(definition.assigned_to)
              : null;
            const cadencia =
              definition.recurrence_every && definition.recurrence_unit
                ? `Cada ${definition.recurrence_every} ${RECURRENCE_UNIT_LABELS[definition.recurrence_unit]}`
                : "Una sola vez";

            return (
              <NavRow
                key={definition.id}
                href={`/tareas/definiciones/${definition.id}`}
                label={definition.title}
                description={[asset?.name, assignedTo?.display_name, cadencia]
                  .filter(Boolean)
                  .join(" · ")}
                value={formatDate(definition.next_due_date)}
              />
            );
          })}
        </NavGroup>
      )}

      <FloatingAction>
        <DefinitionFormDialog assets={assets} members={members} />
      </FloatingAction>
    </div>
  );
}
