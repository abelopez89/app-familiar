import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentFamilyContext } from "@/lib/family";
import { listAssets, listActiveMembers, listTaskDefinitions } from "@/lib/tasks/queries";
import { formatDate } from "@/lib/dates";
import { RECURRENCE_UNIT_LABELS } from "@/lib/tasks/constants";
import { Card, CardContent } from "@/components/ui/card";
import { DefinitionFormDialog } from "./definition-form-dialog";

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
    <div className="flex flex-col gap-4 pb-24">
      <h1 className="text-xl font-semibold">Definiciones de tareas</h1>

      {definitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tenés tareas definidas todavía.</p>
      ) : (
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {definitions.map((definition) => {
              const asset = definition.asset_id ? assetsById.get(definition.asset_id) : null;
              const assignedTo = definition.assigned_to ? membersById.get(definition.assigned_to) : null;

              return (
                <Link
                  key={definition.id}
                  href={`/tareas/definiciones/${definition.id}`}
                  className="flex flex-col gap-1 px-4 py-3.5"
                >
                  <span className="text-sm font-medium">{definition.title}</span>
                  <span className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {asset && <span>{asset.name}</span>}
                    {assignedTo && <span>{assignedTo.display_name}</span>}
                    <span>
                      {definition.recurrence_every && definition.recurrence_unit
                        ? `Cada ${definition.recurrence_every} ${RECURRENCE_UNIT_LABELS[definition.recurrence_unit]}`
                        : "Una sola vez"}
                    </span>
                    <span>Próximo: {formatDate(definition.next_due_date)}</span>
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-20 right-4 z-30">
        <DefinitionFormDialog assets={assets} members={members} />
      </div>
    </div>
  );
}
