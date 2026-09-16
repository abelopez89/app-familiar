import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Asset, FuelLog, TaskDefinition, Vehicle } from "@/lib/supabase/types";

export async function listVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/**
 * Todas las cargas de un vehículo, ordenadas por odómetro ascendente —
 * es el orden que importa para el cálculo de rendimiento (ver
 * lib/fuel/consumption.ts). El listado del historial en la UI las
 * muestra invertidas.
 */
export async function listFuelLogs(vehicleId: string): Promise<FuelLog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fuel_logs")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("odometer", { ascending: true });
  return data ?? [];
}

export async function getLastFuelLog(vehicleId: string): Promise<FuelLog | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fuel_logs")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("odometer", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Último vehículo cargado por este miembro (por fecha de carga, no por
 * odómetro) — sirve para preseleccionar el campo en /combustible/nueva.
 */
export async function getLastUsedVehicleId(memberId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fuel_logs")
    .select("vehicle_id")
    .eq("member_id", memberId)
    .order("filled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.vehicle_id ?? null;
}

/**
 * Activos de tipo 'vehiculo' que todavía no están vinculados a ningún
 * vehículo — son los candidatos para "vincular a un activo existente"
 * en el formulario de vehículos. `excludeVehicleId` deja pasar el activo
 * que ya tiene vinculado ESE vehículo al editarlo, para que no desaparezca
 * de la lista.
 */
export async function listLinkableVehicleAssets(excludeVehicleId?: string): Promise<Asset[]> {
  const supabase = await createClient();

  const [assetsRes, vehiclesRes] = await Promise.all([
    supabase.from("assets").select("*").eq("asset_type", "vehiculo").eq("is_active", true),
    supabase.from("vehicles").select("id, asset_id").eq("is_active", true),
  ]);

  const linkedAssetIds = new Set(
    (vehiclesRes.data ?? [])
      .filter((v) => v.id !== excludeVehicleId && v.asset_id)
      .map((v) => v.asset_id as string),
  );

  return (assetsRes.data ?? []).filter((asset) => !linkedAssetIds.has(asset.id));
}

/**
 * Tareas de mantenimiento pendientes (activas, sin importar si ya
 * vencieron) de un vehículo, leídas por su asset_id vinculado — ver
 * CLAUDE.md, Fase 4: es gratis y cierra el círculo con la Fase 3, sin
 * agregar columnas a task_definitions.
 */
export async function listPendingTaskDefinitionsForAsset(assetId: string): Promise<TaskDefinition[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_definitions")
    .select("*")
    .eq("asset_id", assetId)
    .eq("is_active", true)
    .order("next_due_date", { ascending: true });
  return data ?? [];
}
