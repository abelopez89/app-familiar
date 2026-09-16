import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getLastFuelLog, getLastUsedVehicleId, listVehicles } from "@/lib/fuel/queries";
import { FuelLogForm } from "./fuel-log-form";

export default async function NuevaCargaPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const vehicles = await listVehicles();
  if (vehicles.length === 0) redirect("/combustible/vehiculos");

  const { vehicle: vehicleFromQuery } = await searchParams;

  const [lastUsedVehicleId, lastLogs] = await Promise.all([
    getLastUsedVehicleId(context.member.id),
    Promise.all(vehicles.map((v) => getLastFuelLog(v.id))),
  ]);

  const lastOdometerByVehicle: Record<string, number | null> = {};
  vehicles.forEach((v, i) => {
    lastOdometerByVehicle[v.id] = lastLogs[i]?.odometer ?? v.initial_odometer;
  });

  // Prioridad: vehículo pasado por link directo (ej. desde el detalle de
  // un vehículo) > último usado por esta persona > el primero de la lista.
  const defaultVehicleId =
    (vehicleFromQuery && vehicles.some((v) => v.id === vehicleFromQuery) ? vehicleFromQuery : null) ??
    (lastUsedVehicleId && vehicles.some((v) => v.id === lastUsedVehicleId) ? lastUsedVehicleId : null) ??
    vehicles[0].id;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Cargar combustible</h1>
      <FuelLogForm
        vehicles={vehicles}
        defaultVehicleId={defaultVehicleId}
        lastOdometerByVehicle={lastOdometerByVehicle}
      />
    </div>
  );
}
