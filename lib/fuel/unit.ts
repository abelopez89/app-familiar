import "server-only";
import { cookies } from "next/headers";
import { FUEL_UNIT_COOKIE, parseFuelUnit, type FuelUnit } from "@/lib/fuel/efficiency";

/** Unidad de rendimiento elegida en este dispositivo (ver lib/fuel/efficiency.ts). */
export async function getFuelUnit(): Promise<FuelUnit> {
  const store = await cookies();
  return parseFuelUnit(store.get(FUEL_UNIT_COOKIE)?.value);
}
