import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getTaskDefinition, listAssets, listActiveMembers, listTaskHistory } from "@/lib/tasks/queries";
import { formatDate } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { RECURRENCE_ANCHOR_LABELS, RECURRENCE_UNIT_LABELS } from "@/lib/tasks/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionFormDialog } from "../definition-form-dialog";
import { DeleteDefinitionButton } from "./delete-definition-button";
import { Button } from "@/components/ui/button";

export default async function DefinitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const [definition, assets, members, history] = await Promise.all([
    getTaskDefinition(id),
    listAssets(),
    listActiveMembers(),
    listTaskHistory(id),
  ]);

  if (!definition) notFound();

  const asset = definition.asset_id ? assets.find((a) => a.id === definition.asset_id) : null;
  const assignedTo = definition.assigned_to ? members.find((m) => m.id === definition.assigned_to) : null;
  const membersById = new Map(members.map((m) => [m.id, m]));

  const totalCost = history.reduce((sum, h) => sum + (h.cost ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{definition.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {definition.description && <p className="text-muted-foreground">{definition.description}</p>}
          {asset && <p>Activo: {asset.name}</p>}
          <p>Responsable: {assignedTo?.display_name ?? "Cualquiera de la familia"}</p>
          <p>
            Repetición:{" "}
            {definition.recurrence_every && definition.recurrence_unit
              ? `Cada ${definition.recurrence_every} ${RECURRENCE_UNIT_LABELS[definition.recurrence_unit]} · ${RECURRENCE_ANCHOR_LABELS[definition.recurrence_anchor].label}`
              : "Una sola vez"}
          </p>
          <p>Próximo vencimiento: {definition.is_active ? formatDate(definition.next_due_date) : "—"}</p>
          <p>Avisa con {definition.lead_days} días de anticipación por Telegram: {definition.notify_telegram ? "Sí" : "No"}</p>
          {!definition.is_active && <p className="text-muted-foreground">Inactiva.</p>}

          <div className="mt-2 flex gap-2">
            <DefinitionFormDialog
              assets={assets}
              members={members}
              definition={definition}
              trigger={<Button variant="outline">Editar</Button>}
            />
            <DeleteDefinitionButton id={definition.id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Historial</span>
            {totalCost > 0 && <span className="text-sm font-normal text-muted-foreground">{formatGuaranies(totalCost)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {history.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Todavía no se completó ninguna vez.</p>
          ) : (
            history.map((instance) => (
              <div key={instance.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span>
                    {instance.status === "hecha" ? "Hecha" : "Omitida"} ·{" "}
                    {formatDate(instance.completed_at ?? instance.due_date)}
                  </span>
                  {instance.completed_by && (
                    <span className="text-xs text-muted-foreground">
                      {membersById.get(instance.completed_by)?.display_name}
                    </span>
                  )}
                  {instance.notes && <span className="text-xs text-muted-foreground">{instance.notes}</span>}
                </div>
                {instance.cost != null && <span className="text-muted-foreground">{formatGuaranies(instance.cost)}</span>}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
