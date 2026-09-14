"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";

export type ActionResult = { error?: string };

export async function toggleItemChecked(
  itemId: string,
  isChecked: boolean,
): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_list_items")
    .update({
      is_checked: isChecked,
      checked_at: isChecked ? new Date().toISOString() : null,
      checked_by: isChecked ? context.member.id : null,
    })
    .eq("id", itemId);

  if (error) return { error: "No se pudo guardar el cambio." };
  return {};
}

export async function markListInProgress(listId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("shopping_lists")
    .update({ status: "en_curso" })
    .eq("id", listId)
    .eq("status", "abierta");
}

const closeSchema = z.object({
  total_amount: z
    .union([z.coerce.number().positive(), z.literal("")])
    .optional(),
});

export async function closeShoppingList(
  listId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = closeSchema.safeParse({
    total_amount: formData.get("total_amount") ?? "",
  });

  if (!parsed.success) {
    return { error: "El total ingresado no es válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_lists")
    .update({
      status: "cerrada",
      closed_at: new Date().toISOString(),
      total_amount:
        typeof parsed.data.total_amount === "number" ? parsed.data.total_amount : null,
    })
    .eq("id", listId);

  if (error) return { error: "No se pudo cerrar la compra." };

  revalidatePath("/compras");
  revalidatePath("/");
  redirect("/compras");
}
