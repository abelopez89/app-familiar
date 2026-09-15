"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean; id?: string };

const assetSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  asset_type: z.enum(["electrodomestico", "instalacion", "vehiculo", "otro"]),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  location: z.string().trim().optional(),
  purchased_at: z.string().trim().optional(),
  warranty_until: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function parseAssetForm(formData: FormData) {
  const parsed = assetSchema.safeParse({
    name: formData.get("name"),
    asset_type: formData.get("asset_type") ?? "electrodomestico",
    brand: formData.get("brand") ?? "",
    model: formData.get("model") ?? "",
    location: formData.get("location") ?? "",
    purchased_at: formData.get("purchased_at") ?? "",
    warranty_until: formData.get("warranty_until") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." } as const;
  }
  return { data: parsed.data } as const;
}

export async function createAsset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseAssetForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert({
      family_id: context.family.id,
      name: parsed.data.name,
      asset_type: parsed.data.asset_type,
      brand: parsed.data.brand || null,
      model: parsed.data.model || null,
      location: parsed.data.location || null,
      purchased_at: parsed.data.purchased_at || null,
      warranty_until: parsed.data.warranty_until || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el activo." };

  revalidatePath("/tareas/activos");
  return { success: true, id: data.id };
}

export async function updateAsset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Activo inválido." };

  const parsed = parseAssetForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({
      name: parsed.data.name,
      asset_type: parsed.data.asset_type,
      brand: parsed.data.brand || null,
      model: parsed.data.model || null,
      location: parsed.data.location || null,
      purchased_at: parsed.data.purchased_at || null,
      warranty_until: parsed.data.warranty_until || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el activo." };

  revalidatePath("/tareas/activos");
  revalidatePath(`/tareas/activos/${id}`);
  return { success: true, id };
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("assets").update({ is_active: false }).eq("id", id);

  if (error) return { error: "No se pudo eliminar el activo." };

  revalidatePath("/tareas/activos");
  return { success: true };
}
