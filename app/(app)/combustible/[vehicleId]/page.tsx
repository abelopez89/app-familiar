import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentFamilyContext } from "@/lib/family";
import {
  getVehicle,
  listFuelLogs,
  listLinkableVehicleAssets,
  listPendingTaskDefinitionsForAsset,
} from "@/lib/fuel/queries";
import { computeFuelIntervals } from "@/lib/fuel/consumption";
import { FUEL_TYPES } from "@/lib/fuel/constants";
import { formatDate, todayInFamilyTimezone } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VehicleFormDialog } from "../vehiculos/vehicle-form-dialog";
import { PerformanceChart } from "./performance-chart";
import { PriceChart } from "./price-chart";
import { FuelLogEditDialog } from "./fuel-log-edit-dialog";

export default async function VehicleDetailPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { vehicleId } = await params;
  const [vehicle, logs, linkableAssets] = await Promise.all([
    getVehicle(vehicleId),
    listFuelLogs(vehicleId),
    listLinkableVehicleAssets(vehicleId),
  ]);

  if (!vehicle) notFound();

  const pendingTasks = vehicle.asset_id ? await listPendingTaskDefinitionsForAsset(vehicle.asset_id) : [];

  const intervals = computeFuelIntervals(logs);
  const logDates = Object.fromEntries(logs.map((l) => [l.id, l.filled_at]));

  const averageKmPerLiter =
    intervals.length > 0 ? intervals.reduce((s, i) => s + i.kmPerLiter, 0) / intervals.length : null;
  const best = intervals.length > 0 ? intervals.reduce((a, b) => (b.kmPerLiter > a.kmPerLiter ? b : a)) : null;
  const worst = intervals.length > 0 ? intervals.reduce((a, b) => (b.kmPerLiter < a.kmPerLiter ? b : a)) : null;
  const totalKm = intervals.reduce((s, i) => s + i.km, 0);
  const totalAmountAllIntervals = intervals.reduce((s, i) => s + i.totalAmount, 0);
  const costPerKm = totalKm > 0 ? totalAmountAllIntervals / totalKm : null;

  const currentYear = todayInFamilyTimezone().slice(0, 4);
  const logsThisYear = logs.filter((l) => l.filled_at.startsWith(currentYear));
  const litersThisYear = logsThisYear.reduce((s, l) => s + l.liters, 0);
  const spentThisYear = logsThisYear.reduce((s, l) => s + (l.total_amount ?? 0), 0);

  const historyDesc = [...logs].sort((a, b) => Date.parse(b.filled_at) - Date.parse(a.filled_at));

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{vehicle.name}</h1>
        <VehicleFormDialog
          vehicle={vehicle}
          linkableAssets={linkableAssets}
          trigger={
            <Button variant="outline" size="sm">
              Editar
            </Button>
          }
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {FUEL_TYPES[vehicle.fuel_type].label}
        {vehicle.plate ? ` · ${vehicle.plate}` : ""}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estadísticas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Rendimiento promedio</p>
            <p>{averageKmPerLiter ? `${averageKmPerLiter.toFixed(1)} km/L` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Costo por km</p>
            <p>{costPerKm ? formatGuaranies(costPerKm) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Mejor tramo</p>
            <p>{best ? `${best.kmPerLiter.toFixed(1)} km/L` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Peor tramo</p>
            <p>{worst ? `${worst.kmPerLiter.toFixed(1)} km/L` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Litros en {currentYear}</p>
            <p>{litersThisYear.toFixed(1)} L</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gasto en {currentYear}</p>
            <p>{formatGuaranies(spentThisYear)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rendimiento por carga</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceChart intervals={intervals} logDates={logDates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Precio por litro</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceChart logs={logs} />
        </CardContent>
      </Card>

      {vehicle.asset_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tareas de mantenimiento pendientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {pendingTasks.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No tiene tareas pendientes.</p>
            ) : (
              pendingTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tareas/definiciones/${task.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>{task.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(task.next_due_date)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de cargas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {historyDesc.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin cargas todavía.</p>
          ) : (
            historyDesc.map((log) => (
              <FuelLogEditDialog
                key={log.id}
                log={log}
                trigger={
                  <button type="button" className="flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm">
                    <span className="flex items-center justify-between">
                      <span className="font-medium">{log.odometer.toLocaleString("es-PY")} km</span>
                      <span className="text-muted-foreground">{formatDate(log.filled_at)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{log.liters.toFixed(1)} L</span>
                      {log.total_amount != null && <span>{formatGuaranies(log.total_amount)}</span>}
                      {!log.is_full_tank && <span>Parcial</span>}
                      {log.resets_calculation && <span>Reinicia cálculo</span>}
                    </span>
                  </button>
                }
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
