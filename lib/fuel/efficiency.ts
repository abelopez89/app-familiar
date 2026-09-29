// Unidad en la que se MUESTRA el rendimiento. El cálculo sigue siendo en
// km/L dentro de lib/fuel/consumption.ts (intervalos, promedio, alerta de
// consumo excesivo) y no se toca: esto es solo presentación. L/100 km es
// la inversa exacta (100 / km por litro), así que "mejor" y "peor" tramo
// siguen siendo los mismos tramos — con L/100 km, el mejor es el número
// más bajo.

export type FuelUnit = "l100km" | "kml";

/** Por defecto, litros cada 100 km (pedido del usuario). */
export const DEFAULT_FUEL_UNIT: FuelUnit = "l100km";

/**
 * La preferencia se guarda en una cookie de este dispositivo: no hace
 * falta una columna ni una migración para una preferencia de lectura, y
 * los Server Components la leen sin JavaScript extra.
 */
export const FUEL_UNIT_COOKIE = "fuel_unit";

export const FUEL_UNITS: Record<FuelUnit, { label: string; short: string }> = {
  l100km: { label: "Litros cada 100 km", short: "L/100 km" },
  kml: { label: "Kilómetros por litro", short: "km/L" },
};

export function parseFuelUnit(value: string | undefined | null): FuelUnit {
  return value === "kml" || value === "l100km" ? value : DEFAULT_FUEL_UNIT;
}

export function efficiencyValue(kmPerLiter: number, unit: FuelUnit): number {
  return unit === "kml" ? kmPerLiter : 100 / kmPerLiter;
}

/** "7,8 L/100 km" o "12,8 km/L". */
export function formatEfficiency(kmPerLiter: number, unit: FuelUnit): string {
  const value = efficiencyValue(kmPerLiter, unit);
  return `${value.toLocaleString("es-PY", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${FUEL_UNITS[unit].short}`;
}
