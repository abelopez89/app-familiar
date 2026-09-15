"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean; id?: string };

const vehicleSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  plate: z.string().trim().optional(),
  fuel_type: z.enum(["nafta", "diesel", "flex", "gnv"]),
  tank_capacity: z.string().trim().optional(),
  initial_odometer: z.string().trim().optional(),
  asset_mode: z.enum(["none", "existing", "new"]),
  asset_id: z.string().trim().optional(),
});

function parseVehicleForm(formData: FormData) {
  const parsed = vehicleSchema.safeParse({
    name: formData.get("name"),
    plate: formData.get("plate") ?? "",
    fuel_type: formData.get("fuel_type") ?? "nafta",
    tank_capacity: formData.get("tank_capacity") ?? "",
    initial_odometer: formData.get("initial_odometer") ?? "",
    asset_mode: formData.get("asset_mode") ?? "none",
    asset_id: formData.get("asset_id") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }
  if (parsed.data.asset_mode === "existing" && !parsed.data.asset_id) {
    return { error: "Elegí el activo a vincular." } as const;
  }
  return { data: parsed.data } as const;
}

/**
 * Resuelve el asset_id a guardar según el modo elegido en el formulario:
 * ninguno, uno existente, o uno nuevo creado en el mismo alta (con
 * asset_type = 'vehiculo', para que el auto no exista dos veces en la
 * base — ver CLAUDE.md, Fase 4).
 */
async function resolveAssetId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  vehicleName: string,
  data: { asset_mode: "none" | "existing" | "new"; asset_id?: string },
): Promise<{ assetId: string | null } | { error: string }> {
  if (data.asset_mode === "none") return { assetId: null };
  if (data.asset_mode === "existing") return { assetId: data.asset_id ?? null };

  const { data: asset, error } = await supabase
    .from("assets")
    .insert({ family_id: familyId, name: vehicleName, asset_type: "vehiculo" })
    .select("id")
    .single();

  if (error || !asset) return { error: "No se pudo crear el activo vinculado." };
  return { assetId: asset.id };
}

export async function createVehicle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseVehicleForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const assetResult = await resolveAssetId(supabase, context.family.id, parsed.data.name, parsed.data);
  if ("error" in assetResult) return { error: assetResult.error };

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      family_id: context.family.id,
      asset_id: assetResult.assetId,
      name: parsed.data.name,
      plate: parsed.data.plate || null,
      fuel_type: parsed.data.fuel_type,
      tank_capacity: parsed.data.tank_capacity ? Number(parsed.data.tank_capacity) : null,
      initial_odometer: parsed.data.initial_odometer ? Number(parsed.data.initial_odometer) : null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el vehículo." };

  revalidatePath("/combustible/vehiculos");
  revalidatePath("/combustible");
  return { success: true, id: data.id };
}

export async function updateVehicle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Vehículo inválido." };

  const parsed = parseVehicleForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const assetResult = await resolveAssetId(supabase, context.family.id, parsed.data.name, parsed.data);
  if ("error" in assetResult) return { error: assetResult.error };

  const { error } = await supabase
    .from("vehicles")
    .update({
      asset_id: assetResult.assetId,
      name: parsed.data.name,
      plate: parsed.data.plate || null,
      fuel_type: parsed.data.fuel_type,
      tank_capacity: parsed.data.tank_capacity ? Number(parsed.data.tank_capacity) : null,
      initial_odometer: parsed.data.initial_odometer ? Number(parsed.data.initial_odometer) : null,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el vehículo." };

  revalidatePath("/combustible/vehiculos");
  revalidatePath("/combustible");
  revalidatePath(`/combustible/${id}`);
  return { success: true, id };
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update({ is_active: false }).eq("id", id);

  if (error) return { error: "No se pudo eliminar el vehículo." };

  revalidatePath("/combustible/vehiculos");
  revalidatePath("/combustible");
  return { success: true };
}
