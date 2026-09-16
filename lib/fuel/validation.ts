import { PLAUSIBLE_KM_PER_LITER_RANGE, averageOdometerJump, computeFuelIntervals, type FuelLogLike } from "@/lib/fuel/consumption";
import { TANK_CAPACITY_OVERFILL_MARGIN } from "@/lib/fuel/constants";

const IMPLAUSIBLE_JUMP_MULTIPLIER = 3;
const CANDIDATE_ID = "__candidate__";

export type FuelLogCandidate = {
  odometer: number;
  liters: number;
  total_amount: number | null;
  is_full_tank: boolean;
  resets_calculation: boolean;
};

/**
 * Advertencias que piden confirmación pero dejan seguir (a diferencia de
 * las bloqueantes: litros <= 0 y odómetro duplicado, que se validan
 * aparte con zod y la restricción única de la base). Ver CLAUDE.md,
 * Fase 4, sección de validaciones.
 */
export function buildFuelLogWarnings(
  existingLogs: FuelLogLike[],
  candidate: FuelLogCandidate,
  tankCapacity: number | null,
): string[] {
  const warnings: string[] = [];

  const maxOdometer = existingLogs.reduce((max, l) => Math.max(max, l.odometer), -Infinity);
  if (existingLogs.length > 0 && candidate.odometer < maxOdometer) {
    warnings.push(
      "Estás cargando una carga anterior a la última registrada (¿te olvidaste de cargar una anterior?). ¿Es correcto?",
    );
  }

  if (tankCapacity && candidate.liters > tankCapacity * (1 + TANK_CAPACITY_OVERFILL_MARGIN)) {
    warnings.push(`Cargaste más litros de los que entran en el tanque (${tankCapacity} L). Revisá el dato.`);
  }

  const avgJump = averageOdometerJump(existingLogs);
  const combined: FuelLogLike[] = [...existingLogs, { id: CANDIDATE_ID, ...candidate }].sort(
    (a, b) => a.odometer - b.odometer,
  );
  const candidateIndex = combined.findIndex((l) => l.id === CANDIDATE_ID);
  const prevLog = candidateIndex > 0 ? combined[candidateIndex - 1] : null;

  if (avgJump && prevLog) {
    const jump = candidate.odometer - prevLog.odometer;
    if (jump > avgJump * IMPLAUSIBLE_JUMP_MULTIPLIER) {
      warnings.push("El salto de kilometraje es mucho mayor al habitual de este vehículo. Revisá el dato.");
    }
  }

  if (candidate.is_full_tank) {
    const intervals = computeFuelIntervals(combined);
    const interval = intervals.find((i) => i.toLogId === CANDIDATE_ID);
    if (
      interval &&
      (interval.kmPerLiter < PLAUSIBLE_KM_PER_LITER_RANGE.min || interval.kmPerLiter > PLAUSIBLE_KM_PER_LITER_RANGE.max)
    ) {
      warnings.push(
        `El rendimiento resultante (${interval.kmPerLiter.toFixed(1)} km/L) es muy distinto al normal. Si te olvidaste de registrar una carga anterior, activá esa opción.`,
      );
    }
  }

  return warnings;
}
