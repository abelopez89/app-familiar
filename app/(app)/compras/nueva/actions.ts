"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { createList } from "@/lib/services/compras";

export type ActionResult = { error?: string };

const schema = z.object({
  templateIds: z.array(z.string().uuid()),
  itemIds: z.array(z.string().uuid()),
});

/**
 * Crea una lista a partir de las plantillas elegidas, o vacía si no se
 * eligió ningún producto: para una compra suelta ("farmacia") no hace
 * falta pasar por una plantilla. La lista vacía se llena después desde
 * `/compras/[id]`, con el mismo campo de producto suelto de siempre.
 */
export async function createShoppingListFromTemplates(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    templateIds: formData.getAll("templateId"),
    itemIds: formData.getAll("itemId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const result = await createList(
    supabase,
    { familyId: context.family.id, memberId: context.member.id },
    { templateIds: parsed.data.templateIds, itemIds: parsed.data.itemIds },
  );

  if (!result.ok) return { error: result.error };

  redirect(`/compras/${result.listId}`);
}
