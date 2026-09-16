import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Fuel } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { getAsset, listActiveMembers, listTaskDefinitions, listTaskHistoryByAsset } from "@/lib/tasks/queries";
import { getVehicleByAssetId } from "@/lib/fuel/queries";
import { listDocumentsWithFiles } from "@/lib/documents/queries";
import { formatDate } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { ASSET_TYPES } from "@/lib/tasks/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssetFormDialog } from "../asset-form-dialog";
import { DeleteAssetButton } from "./delete-asset-button";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const [asset, definitions, members, history, documents] = await Promise.all([
    getAsset(id),
    listTaskDefinitions(),
    listActiveMembers(),
    listTaskHistoryByAsset(id),
    listDocumentsWithFiles(),
  ]);

  if (!asset) notFound();

  const vehicle = asset.asset_type === "vehiculo" ? await getVehicleByAssetId(id) : null;

  const relatedDefinitions = definitions.filter((d) => d.asset_id === id);
  const membersById = new Map(members.map((m) => [m.id, m]));
  const totalCost = history.reduce((sum, h) => sum + (h.cost ?? 0), 0);
  const linkedDocument = asset.document_id ? (documents.find((d) => d.id === asset.document_id) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{asset.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>{ASSET_TYPES[asset.asset_type].label}</p>
          {(asset.brand || asset.model) && (
            <p className="text-muted-foreground">{[asset.brand, asset.model].filter(Boolean).join(" · ")}</p>
          )}
          {asset.location && <p>Ubicación: {asset.location}</p>}
          {asset.purchased_at && <p>Comprado: {formatDate(asset.purchased_at)}</p>}
          {asset.warranty_until && <p>Garantía hasta: {formatDate(asset.warranty_until)}</p>}
          {asset.notes && <p className="text-muted-foreground">{asset.notes}</p>}
          {linkedDocument && (
            <Link href={`/documentos/${linkedDocument.id}`} className="text-primary underline-offset-2 hover:underline">
              Ver manual/factura: {linkedDocument.title}
            </Link>
          )}

          <div className="mt-2 flex gap-2">
            <AssetFormDialog
              asset={asset}
              documents={documents}
              trigger={<Button variant="outline">Editar</Button>}
            />
            <DeleteAssetButton id={asset.id} />
          </div>
        </CardContent>
      </Card>

      {asset.asset_type === "vehiculo" && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-4 text-sm">
            <div className="flex items-center gap-2">
              <Fuel className="size-4 text-muted-foreground" />
              <span>
                {vehicle
                  ? "Kilometraje, tanque y combustible de este vehículo"
                  : "Este activo todavía no tiene un vehículo vinculado"}
              </span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={vehicle ? `/combustible/${vehicle.id}` : "/combustible/vehiculos"}>
                {vehicle ? "Ver" : "Vincular"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tareas asociadas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {relatedDefinitions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No tiene tareas asociadas.</p>
          ) : (
            relatedDefinitions.map((definition) => (
              <Link
                key={definition.id}
                href={`/tareas/definiciones/${definition.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>{definition.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(definition.next_due_date)}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Historial de mantenimiento</span>
            {totalCost > 0 && <span className="text-sm font-normal text-muted-foreground">{formatGuaranies(totalCost)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {history.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin historial todavía.</p>
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
