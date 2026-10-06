import "server-only";
import { checkConsumptionDrop, computeFuelIntervals, type FuelInterval } from "@/lib/fuel/consumption";
import { buildFuelLogWarningDetails, type FuelLogWarning } from "@/lib/fuel/validation";
import type { Actor, Db } from "@/lib/services/types";
import type { FuelLog, Vehicle } from "@/lib/supabase/types";

// Carga de combustible, compartida entre `/combustible/nueva` y `/nafta`
// del bot. Las validaciones (odómetro duplicado, carga anterior a la
// última, litros contra el tanque, salto de kilometraje, rendimiento
// implausible) y el cálculo de rendimiento son los mismos para los dos:
// lib/fuel/validation.ts y lib/fuel/consumption.ts, que no se tocaron
// salvo para exponer el código de cada advertencia.

export async function listVehicles(db: Db, familyId: string): Promise<Vehicle[]> {
  const { data } = await db
    .from("vehicles")
    .select("*")
    .eq("family_id", familyId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getVehicle(db: Db, familyId: string, vehicleId: string): Promise<Vehicle | null> {
  const { data } = await db
    .from("vehicles")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", vehicleId)
    .maybeSingle();
  return data;
}

/** La carga de mayor odómetro del vehículo (la "última" en la cadena). */
export async function getLastFuelLog(db: Db, familyId: string, vehicleId: string): Promise<FuelLog | null> {
  const { data } = await db
    .from("fuel_logs")
    .select("*")
    .eq("family_id", familyId)
    .eq("vehicle_id", vehicleId)
    .order("odometer", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Último vehículo cargado por este miembro (por fecha de carga). */
export async function getLastUsedVehicleId(db: Db, familyId: string, memberId: string): Promise<string | null> {
  const { data } = await db
    .from("fuel_logs")
    .select("vehicle_id")
    .eq("family_id", familyId)
    .eq("member_id", memberId)
    .order("filled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.vehicle_id ?? null;
}

export type FuelLogInput = {
  vehicleId: string;
  odometer: number;
  liters: number;
  totalAmount: number | null;
  isFullTank: boolean;
  resetsCalculation: boolean;
  station?: string | null;
  fuelGrade?: string | null;
  notes?: string | null;
  /** La persona ya vio las advertencias y eligió guardar igual. */
  confirmed: boolean;
};

export type CreateFuelLogOutcome =
  | { status: "error"; error: string }
  | { status: "warnings"; warnings: FuelLogWarning[] }
  | {
      status: "saved";
      id: string;
      interval?: FuelInterval;
      dropAlert?: { averagePrevious: number; last: FuelInterval };
    };

/**
 * Guarda una carga. Sin `confirmed`, primero devuelve las advertencias
 * (si hay) sin guardar nada. Después de guardar devuelve el rendimiento
 * del intervalo que cierra esta carga y la alerta de consumo excesivo si
 * corresponde — se muestra una sola vez, en este momento (Fase 4).
 */
export async function createFuelLog(db: Db, actor: Actor, input: FuelLogInput): Promise<CreateFuelLogOutcome> {
  const vehicle = await getVehicle(db, actor.familyId, input.vehicleId);
  if (!vehicle) return { status: "error", error: "Vehículo no encontrado." };

  const { data: existingLogs } = await db
    .from("fuel_logs")
    .select("*")
    .eq("family_id", actor.familyId)
    .eq("vehicle_id", input.vehicleId);

  const candidate = {
    odometer: input.odometer,
    liters: input.liters,
    total_amount: input.totalAmount,
    is_full_tank: input.isFullTank,
    resets_calculation: input.resetsCalculation,
  };

  if (!input.confirmed) {
    const warnings = buildFuelLogWarningDetails(existingLogs ?? [], candidate, vehicle.tank_capacity);
    if (warnings.length > 0) return { status: "warnings", warnings };
  }

  const { data: inserted, error } = await db
    .from("fuel_logs")
    .insert({
      family_id: actor.familyId,
      vehicle_id: input.vehicleId,
      member_id: actor.memberId,
      odometer: input.odometer,
      liters: input.liters,
      total_amount: input.totalAmount,
      is_full_tank: input.isFullTank,
      resets_calculation: input.resetsCalculation,
      station: input.station || null,
      fuel_grade: input.fuelGrade || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code === "23505") {
      return { status: "error", error: "Ya cargaste una carga con ese kilometraje para este vehículo." };
    }
    return { status: "error", error: "No se pudo guardar la carga." };
  }

  const allLogs = [...(existingLogs ?? []), { id: inserted.id, ...candidate }];
  const intervals = computeFuelIntervals(allLogs);
  const interval = intervals.find((i) => i.toLogId === inserted.id);
  const drop = checkConsumptionDrop(intervals);
  const dropAlert =
    drop?.shouldAlert && drop.last.toLogId === inserted.id
      ? { averagePrevious: drop.averagePrevious, last: drop.last }
      : undefined;

  return { status: "saved", id: inserted.id, interval, dropAlert };
}
