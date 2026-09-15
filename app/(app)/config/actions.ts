"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string; success?: boolean };

const familyNameSchema = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío."),
});

export async function updateFamilyName(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = familyNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("families")
    .update({ name: parsed.data.name })
    .eq("id", context.family.id);

  if (error) return { error: "No se pudo guardar el nombre." };

  revalidatePath("/config/familia");
  revalidatePath("/", "layout");
  return { success: true };
}

const memberSchema = z.object({
  display_name: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z
    .union([z.string().trim().email("Ingresá un email válido."), z.literal("")])
    .optional(),
  role: z.enum(["adulto", "menor"]),
  color: z.string().trim().min(1),
  can_login: z.coerce.boolean(),
  birth_date: z.union([z.string().trim().min(1), z.literal("")]).optional(),
});

export async function createMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    display_name: formData.get("display_name"),
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "adulto",
    color: formData.get("color") ?? "#6366f1",
    can_login: formData.get("can_login") === "on",
    birth_date: formData.get("birth_date") ?? "",
  };

  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const { display_name, role, color, can_login } = parsed.data;
  const email = parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null;
  const birth_date =
    parsed.data.birth_date && parsed.data.birth_date !== "" ? parsed.data.birth_date : null;

  if (role === "menor" && email) {
    return { error: "Los menores se crean sin email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("family_members").insert({
    family_id: context.family.id,
    display_name,
    email: role === "menor" ? null : email,
    role,
    color,
    can_login: role === "menor" ? false : can_login,
    birth_date,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un miembro con ese email en tu familia." };
    }
    return { error: "No se pudo crear el miembro." };
  }

  revalidatePath("/config/miembros");
  revalidatePath("/eventos");
  revalidatePath("/");
  return { success: true };
}

export async function updateMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Miembro inválido." };

  const raw = {
    display_name: formData.get("display_name"),
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "adulto",
    color: formData.get("color") ?? "#6366f1",
    can_login: formData.get("can_login") === "on",
    birth_date: formData.get("birth_date") ?? "",
  };

  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { display_name, role, color, can_login } = parsed.data;
  const email = parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null;
  const birth_date =
    parsed.data.birth_date && parsed.data.birth_date !== "" ? parsed.data.birth_date : null;

  if (role === "menor" && email) {
    return { error: "Los menores se crean sin email." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("family_members")
    .update({
      display_name,
      email: role === "menor" ? null : email,
      role,
      color,
      can_login: role === "menor" ? false : can_login,
      birth_date,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un miembro con ese email en tu familia." };
    }
    return { error: "No se pudo actualizar el miembro." };
  }

  revalidatePath("/config/miembros");
  revalidatePath("/eventos");
  revalidatePath("/");
  return { success: true };
}

export async function deactivateMember(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("family_members")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: "No se pudo dar de baja al miembro." };

  revalidatePath("/config/miembros");
  revalidatePath("/eventos");
  revalidatePath("/");
  return { success: true };
}
