"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { todayInFamilyTimezone } from "@/lib/dates";
import { createDocument, deleteDocument } from "@/app/(app)/documentos/actions";
import { CURRENCY_CODES, GUEST_COLORS } from "@/lib/expenses/constants";
import {
  checkExactAmounts,
  parseScaledDecimal,
  splitByWeights,
  splitEqual,
  splitExact,
  toAmountPyg,
  type Share,
  MAX_RATE_DECIMALS,
} from "@/lib/expenses/split";
import type { GroupParticipant } from "@/lib/supabase/types";

export type ActionResult = { error?: string; success?: boolean; id?: string };

function revalidateGroup(groupId: string) {
  revalidatePath("/gastos");
  revalidatePath(`/gastos/${groupId}`, "layout");
}

function sortParticipants(participants: GroupParticipant[]): GroupParticipant[] {
  return [...participants].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

/** Lee `rate_<MONEDA>` del formulario. Vacío = sin cotización por defecto. */
function parseDefaultRates(formData: FormData): { rates: Record<string, number> | null; error?: string } {
  const rates: Record<string, number> = {};
  for (const code of CURRENCY_CODES) {
    if (code === "PYG") continue;
    const raw = String(formData.get(`rate_${code}`) ?? "").trim();
    if (!raw) continue;
    const scaled = parseScaledDecimal(raw, MAX_RATE_DECIMALS);
    if (scaled === null || scaled <= BigInt(0)) return { rates: null, error: `La cotización de ${code} no es válida.` };
    rates[code] = Number(raw.replace(",", "."));
  }
  return { rates: Object.keys(rates).length > 0 ? rates : null };
}

const groupSchema = z.object({
  name: z.string().trim().min(1, "Ponele un nombre al grupo."),
  description: z.string().trim().optional(),
  kind: z.enum(["viaje", "evento", "otro"]),
  starts_on: z.string().trim().optional(),
  ends_on: z.string().trim().optional(),
});

// ============ Grupos ============

/**
 * Crea un grupo con sus participantes. Es también el "grupo rápido": el
 * formulario corto manda solo nombre y participantes, y el cliente lleva
 * directo a cargar el primer gasto.
 */
export async function createExpenseGroup(formData: FormData): Promise<ActionResult> {
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    kind: formData.get("kind") || "otro",
    starts_on: formData.get("starts_on") ?? "",
    ends_on: formData.get("ends_on") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { rates, error: ratesError } = parseDefaultRates(formData);
  if (ratesError) return { error: ratesError };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();

  const memberIds = formData.getAll("member_ids").map(String).filter(Boolean);
  const guestNames = formData
    .getAll("guests")
    .map((g) => String(g).trim())
    .filter(Boolean);

  const { data: members } = memberIds.length
    ? await supabase.from("family_members").select("*").in("id", memberIds).order("created_at", { ascending: true })
    : { data: [] };

  if ((members?.length ?? 0) + guestNames.length < 2) {
    return { error: "Un gasto compartido necesita al menos dos personas." };
  }

  const { data: group, error } = await supabase
    .from("expense_groups")
    .insert({
      family_id: context.family.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      starts_on: parsed.data.starts_on || null,
      ends_on: parsed.data.ends_on || null,
      default_rates: rates,
      created_by: context.member.id,
    })
    .select("id")
    .single();
  if (error || !group) return { error: "No se pudo crear el grupo." };

  // Primero los miembros (en su orden de la familia), después los
  // invitados. Este orden es el `sort_order` que decide a quién va el
  // guaraní de resto en cada división.
  const rows = [
    ...(members ?? []).map((m) => ({ member_id: m.id, display_name: m.display_name, color: m.color })),
    ...guestNames.map((name, i) => ({ member_id: null, display_name: name, color: GUEST_COLORS[i % GUEST_COLORS.length] })),
  ].map((p, i) => ({ ...p, group_id: group.id, family_id: context.family.id, sort_order: i + 1 }));

  const { error: participantsError } = await supabase.from("group_participants").insert(rows);
  if (participantsError) {
    await supabase.from("expense_groups").delete().eq("id", group.id);
    return { error: "No se pudieron agregar los participantes." };
  }

  revalidatePath("/gastos");
  return { success: true, id: group.id };
}

export async function updateExpenseGroup(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Grupo inválido." };

  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    kind: formData.get("kind") || "otro",
    starts_on: formData.get("starts_on") ?? "",
    ends_on: formData.get("ends_on") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { rates, error: ratesError } = parseDefaultRates(formData);
  if (ratesError) return { error: ratesError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_groups")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      starts_on: parsed.data.starts_on || null,
      ends_on: parsed.data.ends_on || null,
      default_rates: rates,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar el grupo." };

  revalidateGroup(id);
  return { success: true };
}

/**
 * Cerrar o reabrir. `status` es solo archivo: no condiciona ningún
 * cálculo, y un grupo cerrado se reabre si aparece un gasto tardío.
 */
export async function setExpenseGroupStatus(id: string, status: "abierto" | "cerrado"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_groups")
    .update({ status, closed_at: status === "cerrado" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el grupo." };
  revalidateGroup(id);
  return { success: true };
}

export async function deleteExpenseGroup(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Gastos, partes y pagos se van por `on delete cascade`.
  const { error } = await supabase.from("expense_groups").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el grupo." };
  revalidatePath("/gastos");
  return { success: true };
}

// ============ Participantes ============

export async function addGroupParticipants(
  groupId: string,
  memberIds: string[],
  guestNames: string[],
): Promise<ActionResult> {
  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("group_participants").select("*").eq("group_id", groupId);
  if (!existing) return { error: "Grupo no encontrado." };

  const alreadyIn = new Set(existing.map((p) => p.member_id).filter(Boolean));
  const newMemberIds = memberIds.filter((id) => !alreadyIn.has(id));
  const { data: members } = newMemberIds.length
    ? await supabase.from("family_members").select("*").in("id", newMemberIds).order("created_at", { ascending: true })
    : { data: [] };

  const guests = guestNames.map((g) => g.trim()).filter(Boolean);
  if ((members?.length ?? 0) + guests.length === 0) return { error: "No hay nadie nuevo para agregar." };

  const maxOrder = existing.reduce((acc, p) => Math.max(acc, p.sort_order), 0);
  const guestCount = existing.filter((p) => !p.member_id).length;

  // Los gastos ya cargados no cambian: sus partes están materializadas en
  // expense_shares. El participante nuevo solo entra en los gastos que se
  // carguen de acá en adelante.
  const rows = [
    ...(members ?? []).map((m) => ({ member_id: m.id, display_name: m.display_name, color: m.color })),
    ...guests.map((name, i) => ({
      member_id: null,
      display_name: name,
      color: GUEST_COLORS[(guestCount + i) % GUEST_COLORS.length],
    })),
  ].map((p, i) => ({ ...p, group_id: groupId, family_id: context.family.id, sort_order: maxOrder + i + 1 }));

  const { error } = await supabase.from("group_participants").insert(rows);
  if (error) return { error: "No se pudieron agregar los participantes." };

  revalidateGroup(groupId);
  return { success: true };
}

/**
 * Quitar un participante: se borra solo si no tiene gastos pagados, ni
 * partes, ni pagos registrados. Si tiene, se desactiva — deja de aparecer
 * para gastos nuevos pero sigue contando en los balances (lo que debía
 * no desaparece por sacarlo de la lista).
 */
export async function removeGroupParticipant(
  participantId: string,
): Promise<ActionResult & { deactivated?: boolean }> {
  const supabase = await createClient();
  const { data: participant } = await supabase
    .from("group_participants")
    .select("*")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant) return { error: "Participante no encontrado." };

  const [paid, shares, settlementsFrom, settlementsTo] = await Promise.all([
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("paid_by", participantId),
    supabase.from("expense_shares").select("expense_id", { count: "exact", head: true }).eq("participant_id", participantId),
    supabase.from("settlements").select("id", { count: "exact", head: true }).eq("from_participant", participantId),
    supabase.from("settlements").select("id", { count: "exact", head: true }).eq("to_participant", participantId),
  ]);
  const hasMovements = [paid, shares, settlementsFrom, settlementsTo].some((r) => (r.count ?? 0) > 0 || r.error);

  if (hasMovements) {
    const { error } = await supabase.from("group_participants").update({ is_active: false }).eq("id", participantId);
    if (error) return { error: "No se pudo desactivar al participante." };
    revalidateGroup(participant.group_id);
    return { success: true, deactivated: true };
  }

  const { error } = await supabase.from("group_participants").delete().eq("id", participantId);
  if (error) return { error: "No se pudo quitar al participante." };
  revalidateGroup(participant.group_id);
  return { success: true, deactivated: false };
}

export async function reactivateGroupParticipant(participantId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_participants")
    .update({ is_active: true })
    .eq("id", participantId)
    .select("group_id")
    .maybeSingle();
  if (error || !data) return { error: "No se pudo reactivar al participante." };
  revalidateGroup(data.group_id);
  return { success: true };
}

// ============ Gastos ============

const expenseSchema = z.object({
  group_id: z.string().min(1),
  expense_id: z.string().optional(),
  description: z.string().trim().min(1, "Poné una descripción."),
  amount: z.string().trim().min(1, "Poné el importe."),
  currency: z.string().refine((c) => CURRENCY_CODES.includes(c), "Moneda inválida."),
  exchange_rate: z.string().trim().optional(),
  category_id: z.string().optional(),
  paid_by: z.string().min(1, "Elegí quién pagó."),
  spent_on: z.string().optional(),
  payment_method: z.enum(["efectivo", "transferencia", "tarjeta_credito", "tarjeta_debito", "otro"]),
  split_method: z.enum(["iguales", "partes", "exactos"]),
  notes: z.string().trim().optional(),
});

/**
 * Alta y edición de un gasto. La división la calcula
 * `lib/expenses/split.ts` acá, en el servidor, a partir de lo que eligió
 * la persona (modo, a quiénes, pesos o importes) — nunca se confía en
 * partes calculadas por el cliente. Después `hogar.save_expense()` guarda
 * gasto y partes en una sola transacción y rechaza el gasto si no suman
 * exactamente `amount_pyg`.
 *
 * Editar la cotización pasa por acá mismo: se vuelve a dividir con el
 * nuevo total y las partes se reescriben junto con el gasto.
 */
export async function saveExpense(formData: FormData): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse({
    group_id: formData.get("group_id"),
    expense_id: formData.get("expense_id") || undefined,
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "PYG",
    exchange_rate: formData.get("exchange_rate") ?? "",
    category_id: formData.get("category_id") || undefined,
    paid_by: formData.get("paid_by"),
    spent_on: formData.get("spent_on") || undefined,
    payment_method: formData.get("payment_method") || "efectivo",
    split_method: formData.get("split_method") || "iguales",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const data = parsed.data;

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  // --- Importe y cotización ---
  const amount = data.amount.replace(",", ".");
  if (data.currency === "PYG" && !/^\d+$/.test(amount)) {
    return { error: "En guaraníes el importe va sin decimales." };
  }
  const rate = data.currency === "PYG" ? "1" : (data.exchange_rate ?? "").replace(",", ".");
  if (data.currency !== "PYG" && !rate) return { error: `Falta la cotización de ${data.currency}.` };
  const amountPyg = toAmountPyg(amount, rate);
  if (amountPyg === null) return { error: "Revisá el importe y la cotización (hasta 2 y 6 decimales)." };
  if (amountPyg < 1) return { error: "El gasto tiene que ser de al menos 1 Gs." };

  const supabase = await createClient();

  const [{ data: group }, { data: participantRows }] = await Promise.all([
    supabase.from("expense_groups").select("*").eq("id", data.group_id).maybeSingle(),
    supabase.from("group_participants").select("*").eq("group_id", data.group_id),
  ]);
  if (!group) return { error: "Grupo no encontrado." };
  const participants = sortParticipants(participantRows ?? []);
  const inGroup = new Set(participants.map((p) => p.id));
  if (!inGroup.has(data.paid_by)) return { error: "Quien pagó no participa de este grupo." };

  // --- División ---
  let shares: Share[];
  try {
    if (data.split_method === "iguales") {
      const selected = new Set(formData.getAll("split_ids").map(String));
      const ids = participants.filter((p) => selected.has(p.id)).map((p) => p.id);
      if (ids.length === 0) return { error: "Elegí entre quiénes se divide." };
      shares = splitEqual(amountPyg, ids);
    } else if (data.split_method === "partes") {
      const weights = participants
        .filter((p) => formData.has(`weight_${p.id}`))
        .map((p) => ({ participantId: p.id, weight: String(formData.get(`weight_${p.id}`) ?? "").trim() || "0" }));
      if (weights.some((w) => parseScaledDecimal(w.weight, 2) === null)) {
        return { error: "Los pesos tienen que ser números (hasta 2 decimales)." };
      }
      shares = splitByWeights(amountPyg, weights);
    } else {
      const exacts = participants
        .filter((p) => formData.has(`exact_${p.id}`))
        .map((p) => ({ participantId: p.id, amount: String(formData.get(`exact_${p.id}`) ?? "").replace(",", ".") }));
      const check = checkExactAmounts(amount, exacts);
      if (!check.ok) {
        if (check.difference === 0) return { error: "Revisá los importes: hay uno que no es un número válido." };
        const diff = Math.abs(check.difference).toLocaleString("es-PY", { maximumFractionDigits: 2 });
        return {
          error: `Los importes suman ${check.assigned.toLocaleString("es-PY", { maximumFractionDigits: 2 })} y el gasto es de ${Number(amount).toLocaleString("es-PY", { maximumFractionDigits: 2 })}: ${check.difference > 0 ? "faltan" : "sobran"} ${diff}.`,
        };
      }
      shares = splitExact(amountPyg, amount, exacts);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo dividir el gasto." };
  }

  // --- Ticket (Centro de Documentos, Fase 5) ---
  // Se reutiliza `createDocument` tal cual: misma compresión (ya hecha en
  // el cliente), mismas rutas de Storage y mismas políticas. Nada nuevo
  // de storage para este módulo.
  let receiptDocumentId: string | null = String(formData.get("receipt_document_id") ?? "") || null;
  if (formData.get("remove_receipt") === "on") receiptDocumentId = null;
  let createdReceiptId: string | null = null;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    const docForm = new FormData();
    docForm.set("title", `Ticket: ${data.description}`);
    docForm.set("doc_type", "factura");
    docForm.set("notes", `Gasto compartido del grupo "${group.name}".`);
    docForm.append("files", receipt, receipt.name);
    const doc = await createDocument({}, docForm);
    if (doc.error || !doc.id) return { error: doc.error ?? "No se pudo guardar el ticket." };
    createdReceiptId = doc.id;
    receiptDocumentId = doc.id;
  }

  const { data: savedId, error } = await supabase.rpc("save_expense", {
    p_expense_id: data.expense_id ?? null,
    p_expense: {
      group_id: data.group_id,
      paid_by: data.paid_by,
      category_id: data.category_id ?? null,
      description: data.description,
      spent_on: data.spent_on || todayInFamilyTimezone(),
      amount,
      currency: data.currency,
      exchange_rate: rate,
      payment_method: data.payment_method,
      split_method: data.split_method,
      receipt_document_id: receiptDocumentId,
      notes: data.notes || null,
    },
    p_shares: shares.map((s) => ({ participant_id: s.participantId, share_pyg: s.sharePyg, weight: s.weight })),
  });

  if (error || !savedId) {
    if (createdReceiptId) await deleteDocument(createdReceiptId);
    console.error("[gastos] save_expense falló:", error);
    return { error: error?.code === "23514" ? error.message : "No se pudo guardar el gasto." };
  }

  // Si el grupo todavía no tenía cotización por defecto para esta moneda,
  // queda la que se acaba de usar: el próximo gasto en reales ya la trae
  // precargada. Nunca pisa una cotización por defecto existente.
  if (data.currency !== "PYG" && !(group.default_rates ?? {})[data.currency]) {
    await supabase
      .from("expense_groups")
      .update({ default_rates: { ...(group.default_rates ?? {}), [data.currency]: Number(rate) } })
      .eq("id", group.id);
  }

  revalidateGroup(data.group_id);
  return { success: true, id: savedId };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").delete().eq("id", id).select("group_id").maybeSingle();
  if (error || !data) return { error: "No se pudo eliminar el gasto." };
  revalidateGroup(data.group_id);
  return { success: true };
}

// ============ Pagos (settlements) ============

const settlementSchema = z.object({
  group_id: z.string().min(1),
  from_participant: z.string().min(1, "Elegí quién paga."),
  to_participant: z.string().min(1, "Elegí quién recibe."),
  amount_pyg: z.string().regex(/^\d+$/, "El importe va en guaraníes, sin decimales."),
  settled_on: z.string().optional(),
  payment_method: z.enum(["efectivo", "transferencia", "tarjeta_credito", "tarjeta_debito", "otro"]),
  notes: z.string().trim().optional(),
});

export async function createSettlement(formData: FormData): Promise<ActionResult> {
  const parsed = settlementSchema.safeParse({
    group_id: formData.get("group_id"),
    from_participant: formData.get("from_participant"),
    to_participant: formData.get("to_participant"),
    amount_pyg: String(formData.get("amount_pyg") ?? "").replace(/\D/g, ""),
    settled_on: formData.get("settled_on") || undefined,
    payment_method: formData.get("payment_method") || "efectivo",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const data = parsed.data;
  if (data.from_participant === data.to_participant) return { error: "Quien paga y quien recibe no pueden ser la misma persona." };
  const amountPyg = Number(data.amount_pyg);
  if (amountPyg <= 0) return { error: "El importe tiene que ser mayor a cero." };

  const context = await getCurrentFamilyContext();
  if (!context) return { error: "No se encontró tu familia." };

  const supabase = await createClient();
  const { data: participants } = await supabase
    .from("group_participants")
    .select("id")
    .eq("group_id", data.group_id)
    .in("id", [data.from_participant, data.to_participant]);
  if ((participants?.length ?? 0) !== 2) return { error: "Las dos personas tienen que ser del grupo." };

  const { error } = await supabase.from("settlements").insert({
    group_id: data.group_id,
    family_id: context.family.id,
    from_participant: data.from_participant,
    to_participant: data.to_participant,
    amount_pyg: amountPyg,
    settled_on: data.settled_on || todayInFamilyTimezone(),
    payment_method: data.payment_method,
    notes: data.notes || null,
    created_by: context.member.id,
  });
  if (error) return { error: "No se pudo registrar el pago." };

  revalidateGroup(data.group_id);
  return { success: true };
}

export async function deleteSettlement(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settlements").delete().eq("id", id).select("group_id").maybeSingle();
  if (error || !data) return { error: "No se pudo eliminar el pago." };
  revalidateGroup(data.group_id);
  return { success: true };
}
