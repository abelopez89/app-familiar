import type { FuelInterval, FuelLogLike } from "@/lib/fuel/consumption";

/**
 * Estadísticas de un vehículo a partir de sus cargas y de los tramos de
 * `computeFuelIntervals`. Solo agrega lo que ya se calculó: no vuelve a
 * decidir qué tramo vale (eso es de `lib/fuel/consumption.ts`). La usan el
 * detalle del vehículo y `/combustible` en escritorio, así las dos
 * pantallas muestran exactamente los mismos números.
 */
export function vehicleStats(
  logs: (FuelLogLike & { filled_at: string })[],
  intervals: FuelInterval[],
  currentYear: string,
) {
  const totalKm = intervals.reduce((s, i) => s + i.km, 0);
  const logsThisYear = logs.filter((l) => l.filled_at.startsWith(currentYear));
  return {
    averageKmPerLiter:
      intervals.length > 0 ? intervals.reduce((s, i) => s + i.kmPerLiter, 0) / intervals.length : null,
    best: intervals.length > 0 ? intervals.reduce((a, b) => (b.kmPerLiter > a.kmPerLiter ? b : a)) : null,
    worst: intervals.length > 0 ? intervals.reduce((a, b) => (b.kmPerLiter < a.kmPerLiter ? b : a)) : null,
    costPerKm: totalKm > 0 ? intervals.reduce((s, i) => s + i.totalAmount, 0) / totalKm : null,
    litersThisYear: logsThisYear.reduce((s, l) => s + l.liters, 0),
    spentThisYear: logsThisYear.reduce((s, l) => s + (l.total_amount ?? 0), 0),
  };
}
