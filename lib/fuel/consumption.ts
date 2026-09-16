// ============ Por qué el cálculo vive acá y no en una vista SQL ============
// Una vista sobre tablas con RLS no hereda las políticas (correría con
// los privilegios de su dueño salvo `security_invoker = true`), y el
// volumen de datos es chico — ver la nota al final de la migración 009.
// Mismo patrón que lib/tasks/schedule.ts: funciones puras sobre datos ya
// traídos del server, sin queries acá adentro.

export const PLAUSIBLE_KM_PER_LITER_RANGE = { min: 3, max: 30 } as const;
const CONSUMPTION_DROP_ALERT_THRESHOLD = 0.15;
const CONSUMPTION_DROP_LOOKBACK = 5;

export type FuelLogLike = {
  id: string;
  odometer: number;
  liters: number;
  total_amount: number | null;
  is_full_tank: boolean;
  resets_calculation: boolean;
};

export type FuelInterval = {
  fromLogId: string;
  toLogId: string;
  fromOdometer: number;
  toOdometer: number;
  km: number;
  liters: number;
  totalAmount: number;
  kmPerLiter: number;
  costPerKm: number;
};

/**
 * Calcula los intervalos de rendimiento entre tanques llenos consecutivos
 * (ordenados por odómetro, no por fecha — ver CLAUDE.md, decisión 1 de
 * la Fase 4). Descarta el intervalo si la carga final que lo cierra, o
 * cualquier carga intermedia, tiene resets_calculation = true: eso corta
 * la cadena sin perder el punto de partida del intervalo siguiente.
 */
export function computeFuelIntervals(logs: FuelLogLike[]): FuelInterval[] {
  const sorted = [...logs].sort((a, b) => a.odometer - b.odometer);
  const fullTanks = sorted.filter((l) => l.is_full_tank);

  const intervals: FuelInterval[] = [];

  for (let i = 1; i < fullTanks.length; i++) {
    const from = fullTanks[i - 1];
    const to = fullTanks[i];

    const inRange = sorted.filter((l) => l.odometer > from.odometer && l.odometer <= to.odometer);
    const hasReset = inRange.some((l) => l.resets_calculation);
    if (hasReset) continue;

    const km = to.odometer - from.odometer;
    const liters = inRange.reduce((sum, l) => sum + l.liters, 0);
    const totalAmount = inRange.reduce((sum, l) => sum + (l.total_amount ?? 0), 0);

    if (km <= 0 || liters <= 0) continue;

    intervals.push({
      fromLogId: from.id,
      toLogId: to.id,
      fromOdometer: from.odometer,
      toOdometer: to.odometer,
      km,
      liters,
      totalAmount,
      kmPerLiter: km / liters,
      costPerKm: totalAmount / km,
    });
  }

  return intervals;
}

/**
 * Compara el último intervalo contra el promedio de hasta los cinco
 * anteriores. Alerta si cayó más de un 15%. Devuelve null si no hay
 * suficiente historial (menos de un intervalo previo) para comparar.
 */
export function checkConsumptionDrop(
  intervals: FuelInterval[],
): { shouldAlert: boolean; last: FuelInterval; averagePrevious: number; dropRatio: number } | null {
  if (intervals.length < 2) return null;

  const last = intervals[intervals.length - 1];
  const previous = intervals.slice(Math.max(0, intervals.length - 1 - CONSUMPTION_DROP_LOOKBACK), intervals.length - 1);
  if (previous.length === 0) return null;

  const averagePrevious = previous.reduce((sum, i) => sum + i.kmPerLiter, 0) / previous.length;
  if (averagePrevious <= 0) return null;

  const dropRatio = (averagePrevious - last.kmPerLiter) / averagePrevious;

  return {
    shouldAlert: dropRatio > CONSUMPTION_DROP_ALERT_THRESHOLD,
    last,
    averagePrevious,
    dropRatio,
  };
}

export function averageOdometerJump(logs: FuelLogLike[]): number | null {
  const sorted = [...logs].sort((a, b) => a.odometer - b.odometer);
  if (sorted.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < sorted.length; i++) sum += sorted[i].odometer - sorted[i - 1].odometer;
  return sum / (sorted.length - 1);
}
