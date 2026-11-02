import Link from "next/link";
import { ExternalLink, Fuel, Pencil, Plus, Settings2 } from "lucide-react";
import type { FuelLog, Vehicle } from "@/lib/supabase/types";
import { computeFuelIntervals } from "@/lib/fuel/consumption";
import { vehicleStats } from "@/lib/fuel/stats";
import { FUEL_TYPES } from "@/lib/fuel/constants";
import { formatEfficiency, type FuelUnit } from "@/lib/fuel/efficiency";
import { usosPorReferencia } from "@/lib/promos/usos";
import { formatDate, todayInFamilyTimezone } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PerformanceChart } from "./[vehicleId]/performance-chart";
import { PriceChart } from "./[vehicleId]/price-chart";
import { FuelUnitToggle } from "./fuel-unit-toggle";

export type CombustibleSummary = {
  vehicle: Vehicle;
  logs: FuelLog[];
};

/**
 * Combustible en escritorio (`lg:`): los vehículos arriba como tarjetas y,
 * debajo, el elegido (`?vehiculo=<id>`; sin parámetro, el último cargado)
 * con sus estadísticas, los dos gráficos grandes y el historial de cargas
 * en tabla. Todo sale de `computeFuelIntervals` y `vehicleStats` (lo mismo
 * que el detalle del vehículo) y respeta la cookie `fuel_unit`. Editar una
 * carga abre el mismo diálogo del detalle; cargar combustible y los
 * vehículos siguen en sus pantallas.
 */
export async function CombustibleEscritorio({
  familyId,
  summaries,
  unit,
  selectedId,
}: {
  familyId: string;
  summaries: CombustibleSummary[];
  unit: FuelUnit;
  selectedId?: string;
}) {
  const lastFill = (s: CombustibleSummary) => s.logs.reduce((max, l) => (l.filled_at > max ? l.filled_at : max), "");
  const selected =
    summaries.find((s) => s.vehicle.id === selectedId) ??
    [...summaries].sort((a, b) => lastFill(b).localeCompare(lastFill(a)))[0] ??
    null;
  const { fg, bg } = MODULES_BY_KEY.combustible;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Combustible"
        icon={Fuel}
        iconFg={fg}
        iconBg={bg}
        actions={
          <>
            {summaries.length > 0 && <FuelUnitToggle unit={unit} />}
            <Button asChild variant="outline">
              <Link href="/combustible/vehiculos">
                <Settings2 className="size-4" />
                Vehículos
              </Link>
            </Button>
            <Button asChild>
              <Link href={selected ? `/combustible/nueva?vehicle=${selected.vehicle.id}` : "/combustible/nueva"}>
                <Plus className="size-4" />
                Cargar combustible
              </Link>
            </Button>
          </>
        }
      />

      {!selected ? (
        <p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no tenés vehículos. Cargá tu auto o moto una vez en{" "}
          <Link href="/combustible/vehiculos" className="font-medium text-foreground underline-offset-2 hover:underline">
            Vehículos
          </Link>{" "}
          y después solo anotás cada carga.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {summaries.map((s) => (
              <VehicleCard key={s.vehicle.id} summary={s} unit={unit} active={s.vehicle.id === selected.vehicle.id} />
            ))}
          </div>
          <VehiclePanel familyId={familyId} summary={selected} unit={unit} />
        </>
      )}
    </div>
  );
}

function VehicleCard({ summary, unit, active }: { summary: CombustibleSummary; unit: FuelUnit; active: boolean }) {
  const { vehicle, logs } = summary;
  const intervals = computeFuelIntervals(logs);
  const last = intervals[intervals.length - 1] ?? null;
  const lastLog = [...logs].sort((a, b) => b.filled_at.localeCompare(a.filled_at))[0];
  const { fg, bg } = MODULES_BY_KEY.combustible;
  return (
    <Link
      href={`/combustible?vehiculo=${vehicle.id}`}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4 transition-colors",
        active ? "border-ring/40 bg-card shadow-sm" : "bg-card/60 hover:bg-card",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", bg)}>
        <Fuel className={cn("size-5", fg)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{vehicle.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {last ? formatEfficiency(last.kmPerLiter, unit) : "Sin tramos"}
          {lastLog ? ` · última carga ${formatDate(lastLog.filled_at, "d MMM")}` : ""}
        </span>
      </span>
    </Link>
  );
}

async function VehiclePanel({
  familyId,
  summary,
  unit,
}: {
  familyId: string;
  summary: CombustibleSummary;
  unit: FuelUnit;
}) {
  const { vehicle, logs } = summary;
  const intervals = computeFuelIntervals(logs);
  const currentYear = todayInFamilyTimezone().slice(0, 4);
  const stats = vehicleStats(logs, intervals, currentYear);
  const usos = await usosPorReferencia(familyId, "fuel_log_id", logs.map((l) => l.id));
  const logDates = Object.fromEntries(logs.map((l) => [l.id, l.filled_at]));
  const intervalByEndLog = new Map(intervals.map((i) => [i.toLogId, i]));
  const history = [...logs].sort((a, b) => Date.parse(b.filled_at) - Date.parse(a.filled_at));

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">{vehicle.name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {FUEL_TYPES[vehicle.fuel_type].label}
              {vehicle.plate ? ` · ${vehicle.plate}` : ""}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/combustible/${vehicle.id}`}>
              <ExternalLink className="size-4" />
              Ver detalle
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-6 gap-4 border-t pt-4">
          <Dato label="Promedio" value={stats.averageKmPerLiter ? formatEfficiency(stats.averageKmPerLiter, unit) : "—"} />
          <Dato label="Costo por km" value={stats.costPerKm ? formatGuaranies(stats.costPerKm) : "—"} />
          <Dato label="Mejor tramo" value={stats.best ? formatEfficiency(stats.best.kmPerLiter, unit) : "—"} />
          <Dato label="Peor tramo" value={stats.worst ? formatEfficiency(stats.worst.kmPerLiter, unit) : "—"} />
          <Dato label={`Litros en ${currentYear}`} value={`${stats.litersThisYear.toFixed(1)} L`} />
          <Dato label={`Gasto en ${currentYear}`} value={formatGuaranies(stats.spentThisYear)} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-5">
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Rendimiento por carga</h3>
          <PerformanceChart intervals={intervals} logDates={logDates} unit={unit} width={480} height={200} showAverage />
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Precio por litro</h3>
          <PriceChart logs={logs} width={480} height={200} />
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card text-sm shadow-sm">
        <h3 className="px-5 pt-5 pb-3 text-sm font-semibold">Historial de cargas</h3>
        {history.length === 0 ? (
          <p className="px-5 pb-6 text-muted-foreground">Sin cargas todavía.</p>
        ) : (
          <div role="table">
            <div
              role="row"
              className="grid grid-cols-[6rem_6.5rem_4.5rem_7.5rem_6rem_7rem_minmax(0,1fr)_2.5rem] gap-3 border-y bg-muted/60 px-5 py-2 text-xs font-medium text-muted-foreground"
            >
              <span role="columnheader">Fecha</span>
              <span role="columnheader" className="text-right">Odómetro</span>
              <span role="columnheader" className="text-right">Litros</span>
              <span role="columnheader" className="text-right">Monto</span>
              <span role="columnheader" className="text-right">Precio/L</span>
              <span role="columnheader" className="text-right">Rendimiento</span>
              <span role="columnheader">Notas</span>
              <span role="columnheader" className="sr-only">Editar</span>
            </div>
            {history.map((log) => {
              const interval = intervalByEndLog.get(log.id);
              const uso = usos.get(log.id);
              const tags = [
                !log.is_full_tank ? "Parcial" : null,
                log.resets_calculation ? "Reinicia cálculo" : null,
                log.station,
              ].filter(Boolean);
              return (
                <div
                  key={log.id}
                  role="row"
                  className="grid grid-cols-[6rem_6.5rem_4.5rem_7.5rem_6rem_7rem_minmax(0,1fr)_2.5rem] items-center gap-3 border-b px-5 py-2 tabular-nums last:border-b-0"
                >
                  <span role="cell">{formatDate(log.filled_at, "dd/MM/yy")}</span>
                  <span role="cell" className="text-right">{log.odometer.toLocaleString("es-PY")} km</span>
                  <span role="cell" className="text-right">{log.liters.toFixed(1)} L</span>
                  <span role="cell" className="text-right">
                    {log.total_amount != null ? formatGuaranies(log.total_amount) : "—"}
                  </span>
                  <span role="cell" className="text-right text-muted-foreground">
                    {log.price_per_liter != null ? formatGuaranies(log.price_per_liter) : "—"}
                  </span>
                  <span role="cell" className="text-right">
                    {interval ? formatEfficiency(interval.kmPerLiter, unit) : "—"}
                  </span>
                  <span role="cell" className="truncate text-xs text-muted-foreground">
                    {tags.join(" · ")}
                    {uso && (
                      <span className="text-mod-promos">
                        {tags.length > 0 ? " · " : ""}Promo −{formatGuaranies(uso.descuento_caja + uso.reintegro)}
                      </span>
                    )}
                  </span>
                  <span role="cell" className="flex justify-end">
                    {/* El diálogo de edición vive en el detalle: `?carga=<id>` lo
                        abre al entrar. Traerlo acá (aun con `next/dynamic`)
                        sumaba ~30 kB al JS inicial de /combustible, que también
                        paga el celular. */}
                    <Link
                      href={`/combustible/${vehicle.id}?carga=${log.id}`}
                      aria-label="Editar carga"
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </Link>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
