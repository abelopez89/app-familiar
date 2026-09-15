"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; success?: boolean };

const fuelLogEditSchema = z.object({
  odometer: z.coerce.number().positive("El kilometraje tiene que ser mayor a 0."),
  liters: z.coerce.number().positive("Los litros tienen que ser mayores a 0."),
  total_amount: z.coerce.number().nonnegative().optional(),
  is_full_tank: z.boolean(),
  resets_calculation: z.boolean(),
  station: z.string().trim().optional(),
  fuel_grade: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/**
 * Editar una carga vieja no vuelve a pedir confirmación de las
 * advertencias de /combustible/nueva (rango implausible, salto de
 * kilometraje, etc.) — acá la persona ya está corrigiendo un dato a
 * propósito, no cargando parada en la estación. Las métricas derivadas
 * se recalculan solas en la próxima lectura, porque no hay nada
 * precalculado que actualizar (ver lib/fuel/consumption.ts).
 */
export async function updateFuelLog(id: string, formData: FormData): Promise<ActionResult> {
  const totalAmountRaw = formData.get("total_amount");
  const parsed = fuelLogEditSchema.safeParse({
    odometer: formData.get("odometer"),
    liters: formData.get("liters"),
    total_amount: totalAmountRaw && totalAmountRaw !== "" ? totalAmountRaw : undefined,
    is_full_tank: formData.get("is_full_tank") === "on",
    resets_calculation: formData.get("resets_calculation") === "on",
    station: formData.get("station") ?? "",
    fuel_grade: formData.get("fuel_grade") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from("fuel_logs").select("vehicle_id").eq("id", id).maybeSingle();
  if (!existing) return { error: "Carga no encontrada." };

  const { error } = await supabase
    .from("fuel_logs")
    .update({
      odometer: parsed.data.odometer,
      liters: parsed.data.liters,
      total_amount: parsed.data.total_amount ?? null,
      is_full_tank: parsed.data.is_full_tank,
      resets_calculation: parsed.data.resets_calculation,
      station: parsed.data.station || null,
      fuel_grade: parsed.data.fuel_grade || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Ya existe una carga con ese kilometraje para este vehículo." };
    return { error: "No se pudo actualizar la carga." };
  }

  revalidatePath(`/combustible/${existing.vehicle_id}`);
  revalidatePath("/combustible");
  return { success: true };
}

export async function deleteFuelLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("fuel_logs").select("vehicle_id").eq("id", id).maybeSingle();
  if (!existing) return { error: "Carga no encontrada." };

  const { error } = await supabase.from("fuel_logs").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la carga." };

  revalidatePath(`/combustible/${existing.vehicle_id}`);
  revalidatePath("/combustible");
  return { success: true };
}
