import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import {
  getLastFuelLog as getLastFuelLogService,
  getLastUsedVehicleId as getLastUsedVehicleIdService,
  listVehicles as listVehiclesService,
} from "@/lib/services/combustible";
import type { Asset, FuelLog, TaskDefinition, Vehicle } from "@/lib/supabase/types";

export const listVehicles = cache(async function listVehicles(): Promise<Vehicle[]> {
  const context = await getCurrentFamilyContext();
  if (!context) return [];
  const supabase = await createClient();
  return listVehiclesService(supabase, context.family.id);
});

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
  const context = await getCurrentFamilyContext();
  if (!context) return null;
  const supabase = await createClient();
  return getLastFuelLogService(supabase, context.family.id, vehicleId);
}

/**
 * Último vehículo cargado por este miembro (por fecha de carga, no por
 * odómetro) — sirve para preseleccionar el campo en /combustible/nueva.
 */
export async function getLastUsedVehicleId(memberId: string): Promise<string | null> {
  const context = await getCurrentFamilyContext();
  if (!context) return null;
  const supabase = await createClient();
  return getLastUsedVehicleIdService(supabase, context.family.id, memberId);
}

/**
 * El vehículo (Fase 4) vinculado a un asset (Fase 3), si existe. Cierra
 * el círculo en el sentido inverso a listPendingTaskDefinitionsForAsset:
 * desde la ficha del activo, un link directo a los datos propios del
 * vehículo (odómetro, combustible, tanque) en vez de que la persona
 * tenga que adivinar que viven en otro módulo.
 */
export async function getVehicleByAssetId(assetId: string): Promise<Vehicle | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("asset_id", assetId)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
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
