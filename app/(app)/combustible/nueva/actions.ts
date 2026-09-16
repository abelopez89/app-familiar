"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { checkConsumptionDrop, computeFuelIntervals, type FuelInterval } from "@/lib/fuel/consumption";
import { buildFuelLogWarnings } from "@/lib/fuel/validation";

const fuelLogSchema = z.object({
  vehicle_id: z.string().trim().min(1, "Elegí un vehículo."),
  odometer: z.coerce.number().positive("El kilometraje tiene que ser mayor a 0."),
  liters: z.coerce.number().positive("Los litros tienen que ser mayores a 0."),
  total_amount: z.coerce.number().nonnegative().optional(),
  is_full_tank: z.boolean(),
  resets_calculation: z.boolean(),
  station: z.string().trim().optional(),
  fuel_grade: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  confirmed: z.boolean(),
});

function parseFuelLogForm(formData: FormData) {
  const totalAmountRaw = formData.get("total_amount");
  const parsed = fuelLogSchema.safeParse({
    vehicle_id: formData.get("vehicle_id"),
    odometer: formData.get("odometer"),
    liters: formData.get("liters"),
    total_amount: totalAmountRaw && totalAmountRaw !== "" ? totalAmountRaw : undefined,
    is_full_tank: formData.get("is_full_tank") === "on",
    resets_calculation: formData.get("resets_calculation") === "on",
    station: formData.get("station") ?? "",
    fuel_grade: formData.get("fuel_grade") ?? "",
    notes: formData.get("notes") ?? "",
    confirmed: formData.get("confirmed") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }
  return { data: parsed.data } as const;
}

export type CreateFuelLogResult = {
  error?: string;
  warnings?: string[];
  success?: boolean;
  id?: string;
  interval?: FuelInterval;
  dropAlert?: { averagePrevious: number; last: FuelInterval };
};

export async function createFuelLog(
  _prev: CreateFuelLogResult,
  formData: FormData,
): Promise<CreateFuelLogResult> {
  const parsed = parseFuelLogForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const data = parsed.data;

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", data.vehicle_id)
    .maybeSingle();
  if (!vehicle) return { error: "Vehículo no encontrado." };

  const { data: existingLogs } = await supabase
    .from("fuel_logs")
    .select("*")
    .eq("vehicle_id", data.vehicle_id);

  const candidate = {
    odometer: data.odometer,
    liters: data.liters,
    total_amount: data.total_amount ?? null,
    is_full_tank: data.is_full_tank,
    resets_calculation: data.resets_calculation,
  };

  if (!data.confirmed) {
    const warnings = buildFuelLogWarnings(existingLogs ?? [], candidate, vehicle.tank_capacity);
    if (warnings.length > 0) return { warnings };
  }

  const { data: inserted, error } = await supabase
    .from("fuel_logs")
    .insert({
      family_id: context.family.id,
      vehicle_id: data.vehicle_id,
      member_id: context.member.id,
      odometer: data.odometer,
      liters: data.liters,
      total_amount: data.total_amount ?? null,
      is_full_tank: data.is_full_tank,
      resets_calculation: data.resets_calculation,
      station: data.station || null,
      fuel_grade: data.fuel_grade || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code === "23505") {
      return { error: "Ya cargaste una carga con ese kilometraje para este vehículo." };
    }
    return { error: "No se pudo guardar la carga." };
  }

  revalidatePath("/combustible");
  revalidatePath(`/combustible/${data.vehicle_id}`);

  const allLogs = [...(existingLogs ?? []), { id: inserted.id, ...candidate }];
  const intervals = computeFuelIntervals(allLogs);
  const interval = intervals.find((i) => i.toLogId === inserted.id);
  const drop = checkConsumptionDrop(intervals);
  const dropAlert = drop?.shouldAlert && drop.last.toLogId === inserted.id
    ? { averagePrevious: drop.averagePrevious, last: drop.last }
    : undefined;

  return { success: true, id: inserted.id, interval, dropAlert };
}
