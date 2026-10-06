import "server-only";
import { todayInFamilyTimezone } from "@/lib/dates";
import { computeBalances } from "@/lib/expenses/settlement";
import {
  checkExactAmounts,
  parseScaledDecimal,
  splitByWeights,
  splitEqual,
  splitExact,
  toAmountPyg,
  type Share,
} from "@/lib/expenses/split";
import { fail, type Actor, type Db, type ServiceResult } from "@/lib/services/types";
import type {
  Expense,
  ExpenseCategory,
  ExpenseGroup,
  ExpensePaymentMethod,
  ExpenseShare,
  ExpenseSplitMethod,
  GroupParticipant,
  Settlement,
} from "@/lib/supabase/types";

// Gastos compartidos (Fase 6), compartido entre las Server Actions y el
// bot de Telegram. Lo importante que NO puede divergir entre los dos:
//
// - La división se calcula acá, en el servidor, con lib/expenses/split.ts
//   (enteros de guaraníes, resto determinístico por orden de
//   participantes). El bot no divide por la cantidad de personas por su
//   cuenta: pasa por `prepareExpense`, igual que el formulario.
// - El guardado pasa por `hogar.save_expense()` (gasto y partes en una
//   transacción, rechaza partes que no suman exacto).
//
// Todas las consultas filtran por `family_id` a mano (admin client).

/*
 * PostgREST corta cada respuesta en 1000 filas por defecto. Un viaje
 * largo puede tener cientos de gastos y, con cinco personas, miles de
 * partes: si la consulta se trunca en silencio, los balances dejan de
 * sumar cero sin que nadie sepa por qué. Por eso todo lo que se usa para
 * calcular se trae paginado hasta la última fila.
 */
const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Orden fijo de participantes: es el que decide a quién va el resto de cada división. */
export function sortParticipants(participants: GroupParticipant[]): GroupParticipant[] {
  return [...participants].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

// ============ Lecturas ============

export async function getGroup(db: Db, familyId: string, groupId: string): Promise<ExpenseGroup | null> {
  const { data } = await db
    .from("expense_groups")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", groupId)
    .maybeSingle();
  return data;
}

export async function listOpenGroups(db: Db, familyId: string): Promise<ExpenseGroup[]> {
  const { data } = await db
    .from("expense_groups")
    .select("*")
    .eq("family_id", familyId)
    .eq("status", "abierto")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Participantes del grupo (activos e inactivos), en el orden fijo del grupo. */
export async function listGroupParticipants(db: Db, familyId: string, groupId: string): Promise<GroupParticipant[]> {
  const { data } = await db
    .from("group_participants")
    .select("*")
    .eq("family_id", familyId)
    .eq("group_id", groupId);
  return sortParticipants(data ?? []);
}

export async function listExpenseCategories(db: Db, familyId: string): Promise<ExpenseCategory[]> {
  const { data } = await db
    .from("expense_categories")
    .select("*")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

/** Método de pago del último gasto cargado en el grupo (default del bot). */
export async function lastPaymentMethod(db: Db, familyId: string, groupId: string): Promise<ExpensePaymentMethod | null> {
  const { data } = await db
    .from("expenses")
    .select("payment_method")
    .eq("family_id", familyId)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.payment_method as ExpensePaymentMethod | undefined) ?? null;
}

export type GroupSummary = {
  group: ExpenseGroup;
  totalPyg: number;
  expenseCount: number;
  participantCount: number;
  /** null si el usuario no participa del grupo. */
  myBalance: number | null;
  isConsistent: boolean;
};

/**
 * Todos los grupos de la familia con su total y el balance de quien mira.
 * Trae los datos de toda la familia de una vez (paginados) en vez de una
 * consulta por grupo: el volumen es chico y así son cinco consultas fijas.
 */
export async function listGroupSummaries(db: Db, familyId: string, memberId: string): Promise<GroupSummary[]> {
  const [groups, participants, expenses, shares, settlements] = await Promise.all([
    fetchAllPages<ExpenseGroup>((from, to) =>
      db
        .from("expense_groups")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAllPages<GroupParticipant>((from, to) =>
      db.from("group_participants").select("*").eq("family_id", familyId).order("id").range(from, to),
    ),
    fetchAllPages<Pick<Expense, "id" | "group_id" | "paid_by" | "amount_pyg">>((from, to) =>
      db
        .from("expenses")
        .select("id, group_id, paid_by, amount_pyg")
        .eq("family_id", familyId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages<Pick<ExpenseShare, "expense_id" | "participant_id" | "share_pyg">>((from, to) =>
      db
        .from("expense_shares")
        .select("expense_id, participant_id, share_pyg")
        .eq("family_id", familyId)
        .order("expense_id")
        .order("participant_id")
        .range(from, to),
    ),
    fetchAllPages<Settlement>((from, to) =>
      db.from("settlements").select("*").eq("family_id", familyId).order("id").range(from, to),
    ),
  ]);

  const expenseGroup = new Map(expenses.map((e) => [e.id, e.group_id]));

  return groups.map((group) => {
    const groupParticipants = sortParticipants(participants.filter((p) => p.group_id === group.id));
    const groupExpenses = expenses.filter((e) => e.group_id === group.id);
    const groupShares = shares.filter((s) => expenseGroup.get(s.expense_id) === group.id);
    const groupSettlements = settlements.filter((s) => s.group_id === group.id);
    const { balances, isConsistent } = computeBalances(
      groupParticipants.map((p) => p.id),
      groupExpenses,
      groupShares,
      groupSettlements,
    );
    const me = groupParticipants.find((p) => p.member_id === memberId);

    return {
      group,
      totalPyg: groupExpenses.reduce((acc, e) => acc + Number(e.amount_pyg), 0),
      expenseCount: groupExpenses.length,
      participantCount: groupParticipants.filter((p) => p.is_active).length,
      myBalance: me ? (balances.find((b) => b.participantId === me.id)?.balance ?? 0) : null,
      isConsistent,
    };
  });
}

// ============ Alta / edición de un gasto ============

/**
 * Cómo se divide. En `partes` y `exactos` solo cuentan los participantes
 * que aparecen en el mapa (los que el formulario mostró), en el orden del
 * grupo — no el orden en que llegaron los datos.
 */
export type ExpenseSplitInput =
  | { method: "iguales"; participantIds: string[] }
  | { method: "partes"; weights: Record<string, string> }
  | { method: "exactos"; exacts: Record<string, string> };

export type ExpenseAmountInput = {
  groupId: string;
  /** Tal cual lo escribió la persona ("150000", "100,50"). */
  amount: string;
  currency: string;
  /** Ignorada en guaraníes. */
  exchangeRate?: string;
  paidBy: string;
  split: ExpenseSplitInput;
};

export type PreparedExpense = {
  group: ExpenseGroup;
  participants: GroupParticipant[];
  /** Normalizados con punto decimal, listos para `save_expense`. */
  amount: string;
  rate: string;
  amountPyg: number;
  shares: Share[];
};

/**
 * Valida importe y cotización, carga grupo y participantes y calcula las
 * partes. No escribe nada: el bot la usa también para la pantalla de
 * confirmación (el detalle de la división que se muestra es exactamente
 * el que se va a guardar).
 */
export async function prepareExpense(
  db: Db,
  familyId: string,
  input: ExpenseAmountInput,
): Promise<ServiceResult<PreparedExpense>> {
  // --- Importe y cotización ---
  const amount = input.amount.replace(",", ".");
  if (input.currency === "PYG" && !/^\d+$/.test(amount)) {
    return fail("En guaraníes el importe va sin decimales.");
  }
  const rate = input.currency === "PYG" ? "1" : (input.exchangeRate ?? "").replace(",", ".");
  if (input.currency !== "PYG" && !rate) return fail(`Falta la cotización de ${input.currency}.`);
  const amountPyg = toAmountPyg(amount, rate);
  if (amountPyg === null) return fail("Revisá el importe y la cotización (hasta 2 y 6 decimales).");
  if (amountPyg < 1) return fail("El gasto tiene que ser de al menos 1 Gs.");

  const [group, participants] = await Promise.all([
    getGroup(db, familyId, input.groupId),
    listGroupParticipants(db, familyId, input.groupId),
  ]);
  if (!group) return fail("Grupo no encontrado.");
  const inGroup = new Set(participants.map((p) => p.id));
  if (!inGroup.has(input.paidBy)) return fail("Quien pagó no participa de este grupo.");

  // --- División ---
  let shares: Share[];
  const split = input.split;
  try {
    if (split.method === "iguales") {
      const selected = new Set(split.participantIds);
      const ids = participants.filter((p) => selected.has(p.id)).map((p) => p.id);
      if (ids.length === 0) return fail("Elegí entre quiénes se divide.");
      shares = splitEqual(amountPyg, ids);
    } else if (split.method === "partes") {
      const weights = participants
        .filter((p) => p.id in split.weights)
        .map((p) => ({ participantId: p.id, weight: split.weights[p.id].trim() || "0" }));
      if (weights.some((w) => parseScaledDecimal(w.weight, 2) === null)) {
        return fail("Los pesos tienen que ser números (hasta 2 decimales).");
      }
      shares = splitByWeights(amountPyg, weights);
    } else {
      const exacts = participants
        .filter((p) => p.id in split.exacts)
        .map((p) => ({ participantId: p.id, amount: split.exacts[p.id].replace(",", ".") }));
      const check = checkExactAmounts(amount, exacts);
      if (!check.ok) {
        if (check.difference === 0) return fail("Revisá los importes: hay uno que no es un número válido.");
        const diff = Math.abs(check.difference).toLocaleString("es-PY", { maximumFractionDigits: 2 });
        return fail(
          `Los importes suman ${check.assigned.toLocaleString("es-PY", { maximumFractionDigits: 2 })} y el gasto es de ${Number(amount).toLocaleString("es-PY", { maximumFractionDigits: 2 })}: ${check.difference > 0 ? "faltan" : "sobran"} ${diff}.`,
        );
      }
      shares = splitExact(amountPyg, amount, exacts);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo dividir el gasto.");
  }

  return { ok: true, group, participants, amount, rate, amountPyg, shares };
}

export type ExpenseDetails = {
  expenseId?: string;
  paidBy: string;
  categoryId: string | null;
  description: string;
  spentOn?: string;
  currency: string;
  paymentMethod: ExpensePaymentMethod;
  splitMethod: ExpenseSplitMethod;
  receiptDocumentId: string | null;
  notes: string | null;
};

/**
 * Guarda un gasto ya preparado con `hogar.save_expense()` (gasto y partes
 * en una transacción). `family_id` y `created_by` van explícitos en el
 * payload: con sesión la función los toma de la sesión e ignora estos;
 * con service role (el bot) son lo único que tiene — ver migración 013.
 */
export async function persistExpense(
  db: Db,
  actor: Actor,
  prepared: PreparedExpense,
  details: ExpenseDetails,
): Promise<ServiceResult<{ id: string }>> {
  const { data: savedId, error } = await db.rpc("save_expense", {
    p_expense_id: details.expenseId ?? null,
    p_expense: {
      family_id: actor.familyId,
      created_by: actor.memberId,
      group_id: prepared.group.id,
      paid_by: details.paidBy,
      category_id: details.categoryId,
      description: details.description,
      spent_on: details.spentOn || todayInFamilyTimezone(),
      amount: prepared.amount,
      currency: details.currency,
      exchange_rate: prepared.rate,
      payment_method: details.paymentMethod,
      split_method: details.splitMethod,
      receipt_document_id: details.receiptDocumentId,
      notes: details.notes,
    },
    p_shares: prepared.shares.map((s) => ({ participant_id: s.participantId, share_pyg: s.sharePyg, weight: s.weight })),
  });

  if (error || !savedId) {
    console.error("[gastos] save_expense falló:", error);
    return fail(error?.code === "23514" ? error.message : "No se pudo guardar el gasto.");
  }

  // Si el grupo todavía no tenía cotización por defecto para esta moneda,
  // queda la que se acaba de usar: el próximo gasto en reales ya la trae
  // precargada. Nunca pisa una cotización por defecto existente.
  const group = prepared.group;
  if (details.currency !== "PYG" && !(group.default_rates ?? {})[details.currency]) {
    await db
      .from("expense_groups")
      .update({ default_rates: { ...(group.default_rates ?? {}), [details.currency]: Number(prepared.rate) } })
      .eq("family_id", actor.familyId)
      .eq("id", group.id);
  }

  return { ok: true, id: savedId };
}
