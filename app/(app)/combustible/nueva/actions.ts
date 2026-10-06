"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import type { FuelInterval } from "@/lib/fuel/consumption";
import { createFuelLog as createFuelLogService } from "@/lib/services/combustible";

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
  const outcome = await createFuelLogService(
    supabase,
    { familyId: context.family.id, memberId: context.member.id },
    {
      vehicleId: data.vehicle_id,
      odometer: data.odometer,
      liters: data.liters,
      totalAmount: data.total_amount ?? null,
      isFullTank: data.is_full_tank,
      resetsCalculation: data.resets_calculation,
      station: data.station,
      fuelGrade: data.fuel_grade,
      notes: data.notes,
      confirmed: data.confirmed,
    },
  );

  if (outcome.status === "error") return { error: outcome.error };
  if (outcome.status === "warnings") return { warnings: outcome.warnings.map((w) => w.message) };

  revalidatePath("/combustible");
  revalidatePath(`/combustible/${data.vehicle_id}`);

  return { success: true, id: outcome.id, interval: outcome.interval, dropAlert: outcome.dropAlert };
}
