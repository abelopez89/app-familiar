import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentFamilyContext } from "@/lib/family";
import { listAssets } from "@/lib/tasks/queries";
import { listDocumentsWithFiles } from "@/lib/documents/queries";
import { ASSET_TYPES } from "@/lib/tasks/constants";
import { Card, CardContent } from "@/components/ui/card";
import { AssetFormDialog } from "./asset-form-dialog";

export default async function ActivosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [assets, documents] = await Promise.all([listAssets(), listDocumentsWithFiles()]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <h1 className="text-xl font-semibold">Activos</h1>

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tenés activos cargados todavía.</p>
      ) : (
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {assets.map((asset) => (
              <Link key={asset.id} href={`/tareas/activos/${asset.id}`} className="flex flex-col gap-1 px-4 py-3.5">
                <span className="text-sm font-medium">{asset.name}</span>
                <span className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  <span>{ASSET_TYPES[asset.asset_type].label}</span>
                  {asset.location && <span>{asset.location}</span>}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-20 right-4 z-30">
        <AssetFormDialog documents={documents} />
      </div>
    </div>
  );
}
