import { redirect } from "next/navigation";
import Link from "next/link";
import { Fuel, Plus, Settings2 } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listFuelLogs, listVehicles } from "@/lib/fuel/queries";
import { computeFuelIntervals } from "@/lib/fuel/consumption";
import { formatDate } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { FUEL_TYPES } from "@/lib/fuel/constants";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { FloatingAction } from "@/components/app-shell/floating-action";

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
    const average =
      recent.length > 0 ? recent.reduce((s, iv) => s + iv.kmPerLiter, 0) / recent.length : null;
    const lastLog = logs[logs.length - 1] ?? null;

    return { vehicle, last, average, lastLog };
  });

  const { fg, bg } = MODULES_BY_KEY.combustible;

  return (
    <div className="flex flex-col gap-5 pb-20">
      <PageHeader
        title="Combustible"
        icon={Fuel}
        iconFg={fg}
        iconBg={bg}
        actions={
          <Button asChild variant="ghost" size="icon" className="size-10">
            <Link href="/combustible/vehiculos" aria-label="Vehículos">
              <Settings2 className="size-5" />
            </Link>
          </Button>
        }
      />

      {summaries.length === 0 ? (
        <EmptyState
          icon={Fuel}
          title="Todavía no tenés vehículos"
          description="Cargá tu auto o moto una vez y después solo anotás cada carga de combustible."
          action={
            <Button asChild>
              <Link href="/combustible/vehiculos">Agregar vehículo</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {summaries.map(({ vehicle, last, average, lastLog }) => (
            <div key={vehicle.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <Link href={`/combustible/${vehicle.id}`} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                    <Fuel className={`size-5 ${fg}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {FUEL_TYPES[vehicle.fuel_type].label}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3">
                  <Stat
                    label="Último rendimiento"
                    value={last ? `${last.kmPerLiter.toFixed(1)} km/L` : "—"}
                  />
                  <Stat label="Promedio" value={average ? `${average.toFixed(1)} km/L` : "—"} />
                  <Stat
                    label="Costo por km"
                    value={last ? formatGuaranies(last.costPerKm) : "—"}
                  />
                  <Stat
                    label="Última carga"
                    value={lastLog ? formatDate(lastLog.filled_at) : "—"}
                  />
                </div>
              </Link>

              {summaries.length > 1 && (
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link href={`/combustible/nueva?vehicle=${vehicle.id}`}>Cargar combustible</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <FloatingAction>
        <Button asChild size="icon" className="size-14 rounded-full shadow-lg">
          <Link href="/combustible/nueva" aria-label="Cargar combustible">
            <Plus className="size-6" />
          </Link>
        </Button>
      </FloatingAction>
    </div>
  );
}
