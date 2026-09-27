import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { computeBalances, type GroupBalances } from "@/lib/expenses/settlement";
import type {
  Expense,
  ExpenseCategory,
  ExpenseGroup,
  ExpenseShare,
  GroupParticipant,
  Settlement,
} from "@/lib/supabase/types";

/*
 * PostgREST corta cada respuesta en 1000 filas por defecto. Un viaje
 * largo puede tener cientos de gastos y, con cinco personas, miles de
 * partes: si la consulta se trunca en silencio, los balances dejan de
 * sumar cero sin que nadie sepa por qué. Por eso todo lo que se usa para
 * calcular se trae paginado hasta la última fila.
 */
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
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
function sortParticipants(participants: GroupParticipant[]): GroupParticipant[] {
  return [...participants].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

export const listExpenseCategories = cache(async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
});

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
export const listGroupSummaries = cache(async function listGroupSummaries(memberId: string): Promise<GroupSummary[]> {
  const supabase = await createClient();

  const [groups, participants, expenses, shares, settlements] = await Promise.all([
    fetchAllPages<ExpenseGroup>((from, to) =>
      supabase.from("expense_groups").select("*").order("created_at", { ascending: false }).range(from, to),
    ),
    fetchAllPages<GroupParticipant>((from, to) =>
      supabase.from("group_participants").select("*").order("id").range(from, to),
    ),
    fetchAllPages<Pick<Expense, "id" | "group_id" | "paid_by" | "amount_pyg">>((from, to) =>
      supabase.from("expenses").select("id, group_id, paid_by, amount_pyg").order("id").range(from, to),
    ),
    fetchAllPages<Pick<ExpenseShare, "expense_id" | "participant_id" | "share_pyg">>((from, to) =>
      supabase
        .from("expense_shares")
        .select("expense_id, participant_id, share_pyg")
        .order("expense_id")
        .order("participant_id")
        .range(from, to),
    ),
    fetchAllPages<Settlement>((from, to) => supabase.from("settlements").select("*").order("id").range(from, to)),
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
