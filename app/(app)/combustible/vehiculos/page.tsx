import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentFamilyContext } from "@/lib/family";
import { listLinkableVehicleAssets, listVehicles } from "@/lib/fuel/queries";
import { FUEL_TYPES } from "@/lib/fuel/constants";
import { Card, CardContent } from "@/components/ui/card";
import { VehicleFormDialog } from "./vehicle-form-dialog";

export default async function VehiculosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [vehicles, linkableAssets] = await Promise.all([listVehicles(), listLinkableVehicleAssets()]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <h1 className="text-xl font-semibold">Vehículos</h1>

      {vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tenés vehículos cargados todavía.</p>
      ) : (
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {vehicles.map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`/combustible/${vehicle.id}`}
                className="flex flex-col gap-1 px-4 py-3.5"
              >
                <span className="text-sm font-medium">{vehicle.name}</span>
                <span className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  <span>{FUEL_TYPES[vehicle.fuel_type].label}</span>
                  {vehicle.plate && <span>{vehicle.plate}</span>}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-20 right-4 z-30">
        <VehicleFormDialog linkableAssets={linkableAssets} />
      </div>
    </div>
  );
}
