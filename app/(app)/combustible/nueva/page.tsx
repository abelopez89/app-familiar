import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getLastFuelLog, getLastUsedVehicleId, listVehicles } from "@/lib/fuel/queries";
import { FuelLogForm } from "./fuel-log-form";

export default async function NuevaCargaPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const vehicles = await listVehicles();
  if (vehicles.length === 0) redirect("/combustible/vehiculos");

  const [lastUsedVehicleId, lastLogs] = await Promise.all([
    getLastUsedVehicleId(context.member.id),
    Promise.all(vehicles.map((v) => getLastFuelLog(v.id))),
  ]);

  const lastOdometerByVehicle: Record<string, number | null> = {};
  vehicles.forEach((v, i) => {
    lastOdometerByVehicle[v.id] = lastLogs[i]?.odometer ?? v.initial_odometer;
  });

  const defaultVehicleId =
    lastUsedVehicleId && vehicles.some((v) => v.id === lastUsedVehicleId) ? lastUsedVehicleId : vehicles[0].id;

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
