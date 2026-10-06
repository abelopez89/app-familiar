import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import {
  fetchAllPages,
  listGroupSummaries as listGroupSummariesService,
  sortParticipants,
  type GroupSummary,
} from "@/lib/services/gastos";
import { computeBalances, type GroupBalances } from "@/lib/expenses/settlement";
import type {
  Expense,
  ExpenseCategory,
  ExpenseGroup,
  ExpenseShare,
  GroupParticipant,
  Settlement,
} from "@/lib/supabase/types";

// `fetchAllPages` (paginar hasta la última fila: PostgREST corta en 1000
// y un truncado silencioso rompe el invariante de suma cero) y el orden
// fijo de participantes viven en lib/services/gastos.ts, compartidos con
// el bot de Telegram.

export const listExpenseCategories = cache(async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
});

export type { GroupSummary };

/**
 * Todos los grupos de la familia con su total y el balance de quien mira
 * (la consulta y el cálculo viven en `lib/services/gastos.ts`).
 */
export const listGroupSummaries = cache(async function listGroupSummaries(memberId: string): Promise<GroupSummary[]> {
  const context = await getCurrentFamilyContext();
  if (!context) return [];
  const supabase = await createClient();
  return listGroupSummariesService(supabase, context.family.id, memberId);
});

export type GroupBundle = {
  group: ExpenseGroup;
  /** Todos, activos e inactivos, en el orden fijo del grupo. */
  participants: GroupParticipant[];
  /** Más nuevos primero (fecha del gasto, después carga). */
  expenses: Expense[];
  shares: ExpenseShare[];
  settlements: Settlement[];
  balances: GroupBalances;
  totalPyg: number;
};

/**
 * Todo lo de un grupo, con los balances ya calculados. Memoizado: el
 * encabezado del grupo y cada pestaña lo piden en el mismo request.
 */
export const getGroupBundle = cache(async function getGroupBundle(groupId: string): Promise<GroupBundle | null> {
  const supabase = await createClient();

  const { data: group } = await supabase.from("expense_groups").select("*").eq("id", groupId).maybeSingle();
  if (!group) return null;

  const [participants, expenses, settlements] = await Promise.all([
    fetchAllPages<GroupParticipant>((from, to) =>
      supabase.from("group_participants").select("*").eq("group_id", groupId).order("id").range(from, to),
    ),
    fetchAllPages<Expense>((from, to) =>
      supabase
        .from("expenses")
        .select("*")
        .eq("group_id", groupId)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAllPages<Settlement>((from, to) =>
      supabase
        .from("settlements")
        .select("*")
        .eq("group_id", groupId)
        .order("settled_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  // Las partes no tienen group_id: se piden por lotes de gastos para no
  // armar una URL gigante con cientos de ids en un solo `in`.
  const shares: ExpenseShare[] = [];
  const ids = expenses.map((e) => e.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    shares.push(
      ...(await fetchAllPages<ExpenseShare>((from, to) =>
        supabase
          .from("expense_shares")
          .select("*")
          .in("expense_id", chunk)
          .order("expense_id")
          .order("participant_id")
          .range(from, to),
      )),
    );
  }

  const ordered = sortParticipants(participants);
  return {
    group,
    participants: ordered,
    expenses,
    shares,
    settlements,
    balances: computeBalances(
      ordered.map((p) => p.id),
      expenses,
      shares,
      settlements,
    ),
    totalPyg: expenses.reduce((acc, e) => acc + Number(e.amount_pyg), 0),
  };
});
