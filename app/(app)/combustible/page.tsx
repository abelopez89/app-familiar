import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listFuelLogs, listVehicles } from "@/lib/fuel/queries";
import { computeFuelIntervals } from "@/lib/fuel/consumption";
import { formatDate } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { FUEL_TYPES } from "@/lib/fuel/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AVERAGE_LOOKBACK = 5;

export default async function CombustiblePage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const vehicles = await listVehicles();
  const logsByVehicle = await Promise.all(vehicles.map((v) => listFuelLogs(v.id)));

  const summaries = vehicles.map((vehicle, i) => {
    const logs = logsByVehicle[i];
    const intervals = computeFuelIntervals(logs);
    const last = intervals[intervals.length - 1] ?? null;
    const recent = intervals.slice(-AVERAGE_LOOKBACK);
    const average = recent.length > 0 ? recent.reduce((s, iv) => s + iv.kmPerLiter, 0) / recent.length : null;
    const lastLog = logs[logs.length - 1] ?? null;

    return { vehicle, last, average, lastLog };
  });

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Combustible</h1>
        <Button asChild variant="outline" size="icon">
          <Link href="/combustible/vehiculos" aria-label="Vehículos">
            <Settings2 className="size-4" />
          </Link>
        </Button>
      </div>

      {summaries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">Todavía no tenés vehículos cargados.</p>
          <Button asChild>
            <Link href="/combustible/vehiculos">Agregar vehículo</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {summaries.map(({ vehicle, last, average, lastLog }) => (
            <Card key={vehicle.id}>
              <CardContent className="flex flex-col gap-2 pt-4">
                <Link href={`/combustible/${vehicle.id}`} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{vehicle.name}</span>
                    <span className="text-xs text-muted-foreground">{FUEL_TYPES[vehicle.fuel_type].label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Último rendimiento</p>
                      <p>{last ? `${last.kmPerLiter.toFixed(1)} km/L` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Promedio</p>
                      <p>{average ? `${average.toFixed(1)} km/L` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Costo por km</p>
                      <p>{last ? formatGuaranies(last.costPerKm) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Última carga</p>
                      <p>{lastLog ? formatDate(lastLog.filled_at) : "—"}</p>
                    </div>
                  </div>
                </Link>
                {summaries.length > 1 && (
                  <Button asChild variant="outline" size="sm" className="mt-1 self-start">
                    <Link href={`/combustible/nueva?vehicle=${vehicle.id}`}>Cargar combustible</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="fixed bottom-20 right-4 z-30">
        <Button asChild size="icon" className="size-14 rounded-full shadow-lg">
          <Link href="/combustible/nueva" aria-label="Cargar combustible">
            <Plus className="size-6" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
