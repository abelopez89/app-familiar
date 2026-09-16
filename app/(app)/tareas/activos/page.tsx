import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listAssets } from "@/lib/tasks/queries";
import { listDocumentsWithFiles } from "@/lib/documents/queries";
import { ASSET_TYPES } from "@/lib/tasks/constants";
import { EmptyState } from "@/components/ui/empty-state";
import { NavGroup, NavRow } from "@/components/ui/nav-row";
import { PageHeader } from "@/components/app-shell/page-header";
import { AssetFormDialog } from "./asset-form-dialog";
import { FloatingAction } from "@/components/app-shell/floating-action";

export default async function ActivosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [assets, documents] = await Promise.all([listAssets(), listDocumentsWithFiles()]);

  return (
    <div className="flex flex-col gap-5 pb-20">
      <PageHeader
        title="Activos"
        description="Electrodomésticos, instalaciones y vehículos de la casa"
      />

      {assets.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Todavía no cargaste ningún activo"
          description="Un activo es el heladera, el aire, el auto: lo que después tiene tareas de mantenimiento y garantía."
        />
      ) : (
        <NavGroup>
          {assets.map((asset) => (
            <NavRow
              key={asset.id}
              href={`/tareas/activos/${asset.id}`}
              label={asset.name}
              description={[ASSET_TYPES[asset.asset_type].label, asset.location]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </NavGroup>
      )}

      <FloatingAction>
        <AssetFormDialog documents={documents} />
      </FloatingAction>
    </div>
  );
}
