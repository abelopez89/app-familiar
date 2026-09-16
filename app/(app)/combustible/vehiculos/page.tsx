import { redirect } from "next/navigation";
import { Car } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listLinkableVehicleAssets, listVehicles } from "@/lib/fuel/queries";
import { FUEL_TYPES } from "@/lib/fuel/constants";
import { EmptyState } from "@/components/ui/empty-state";
import { NavGroup, NavRow } from "@/components/ui/nav-row";
import { PageHeader } from "@/components/app-shell/page-header";
import { VehicleFormDialog } from "./vehicle-form-dialog";
import { FloatingAction } from "@/components/app-shell/floating-action";

export default async function VehiculosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [vehicles, linkableAssets] = await Promise.all([
    listVehicles(),
    listLinkableVehicleAssets(),
  ]);

  return (
    <div className="flex flex-col gap-5 pb-20">
      <PageHeader title="Vehículos" description="Tanque, combustible y odómetro inicial" />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Todavía no cargaste ningún vehículo"
          description="Cargalo una vez y después solo anotás cada carga de combustible."
        />
      ) : (
        <NavGroup>
          {vehicles.map((vehicle) => (
            <NavRow
              key={vehicle.id}
              href={`/combustible/${vehicle.id}`}
              label={vehicle.name}
              description={[FUEL_TYPES[vehicle.fuel_type].label, vehicle.plate]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </NavGroup>
      )}

      <FloatingAction>
        <VehicleFormDialog linkableAssets={linkableAssets} />
      </FloatingAction>
    </div>
  );
}
