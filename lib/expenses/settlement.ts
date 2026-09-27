// Balances y clearing de un grupo de gastos (Fase 6). Funciones puras,
// mismo patrón que lib/tasks/schedule.ts y lib/fuel/consumption.ts.
//
// Los balances son EN VIVO: se calculan sobre los datos actuales, desde
// el primer gasto cargado, y no dependen del `status` del grupo (que es
// solo una marca de archivo). Todo es aritmética de enteros en guaraníes.
//
// Invariante del módulo: la suma de todos los balances de un grupo es
// exactamente cero. Cada gasto suma su `amount_pyg` al pagador y resta
// sus partes (que suman lo mismo, ver lib/expenses/split.ts); cada pago
// registrado suma y resta el mismo importe. Si la suma no da cero hay un
// dato roto (un gasto sin partes, por ejemplo) y la pantalla lo avisa en
// vez de proponer transferencias que no cierran.

export type BalanceExpense = { paid_by: string; amount_pyg: number };
export type BalanceShare = { participant_id: string; share_pyg: number };
export type BalanceSettlement = { from_participant: string; to_participant: string; amount_pyg: number };

export type ParticipantBalance = {
  participantId: string;
  /** Lo que pagó en gastos. */
  paid: number;
  /** Lo que le corresponde según sus partes. */
  owed: number;
  /** Lo que ya pagó en settlements. */
  settledOut: number;
  /** Lo que ya recibió en settlements. */
  settledIn: number;
  /** Positivo: le deben. Negativo: debe. */
  balance: number;
};

export type GroupBalances = {
  balances: ParticipantBalance[];
  /** Suma de todos los balances. Tiene que ser 0. */
  sum: number;
  isConsistent: boolean;
};

/**
 * balance = pagado en gastos − partes + pagos hechos − pagos recibidos.
 *
 * `participantIds` define el orden (sort_order del grupo) y garantiza que
 * aparezca todo participante, aunque todavía no tenga movimientos. Un
 * participante desactivado sigue contando: dejó de aparecer para gastos
 * nuevos, no dejó de deber.
 */
export function computeBalances(
  participantIds: string[],
  expenses: BalanceExpense[],
  shares: BalanceShare[],
  settlements: BalanceSettlement[],
): GroupBalances {
  const byId = new Map<string, ParticipantBalance>();
  const get = (id: string) => {
    let row = byId.get(id);
    if (!row) {
      row = { participantId: id, paid: 0, owed: 0, settledOut: 0, settledIn: 0, balance: 0 };
      byId.set(id, row);
    }
    return row;
  };
  for (const id of participantIds) get(id);

  for (const e of expenses) get(e.paid_by).paid += Number(e.amount_pyg);
  for (const s of shares) get(s.participant_id).owed += Number(s.share_pyg);
  for (const s of settlements) {
    get(s.from_participant).settledOut += Number(s.amount_pyg);
    get(s.to_participant).settledIn += Number(s.amount_pyg);
  }

  let sum = 0;
  for (const row of byId.values()) {
    row.balance = row.paid - row.owed + row.settledOut - row.settledIn;
    sum += row.balance;
  }

  return { balances: [...byId.values()], sum, isConsistent: sum === 0 };
}

export type Transfer = { from: string; to: string; amount: number };

/**
 * Simplificación greedy de deudas: se toma al mayor acreedor y al mayor
 * deudor, se salda el menor de los dos importes y se repite hasta que
 * todos quedan en cero. No es el mínimo absoluto de transferencias en
 * todos los casos, pero es simple y da tres o cuatro líneas al final de
 * un viaje en vez de una por gasto.
 *
 * Determinística: ante empates gana quien aparece primero en `balances`
 * (el orden del grupo). Con balances enteros que suman cero, termina con
 * todos exactamente en cero; si no suman cero devuelve lista vacía — no
 * tiene sentido proponer transferencias sobre números que no cierran.
 */
export function simplifyDebts(balances: ParticipantBalance[]): Transfer[] {
  const sum = balances.reduce((acc, b) => acc + b.balance, 0);
  if (sum !== 0) return [];

  const creditors = balances
    .map((b, index) => ({ id: b.participantId, amount: b.balance, index }))
    .filter((b) => b.amount > 0);
  const debtors = balances
    .map((b, index) => ({ id: b.participantId, amount: -b.balance, index }))
    .filter((b) => b.amount > 0);

  const pickLargest = (list: { amount: number; index: number }[]) =>
    list.reduce<number>((best, item, i) => {
      if (item.amount <= 0) return best;
      if (best === -1) return i;
      const current = list[best];
      return item.amount > current.amount || (item.amount === current.amount && item.index < current.index) ? i : best;
    }, -1);

  const transfers: Transfer[] = [];
  for (;;) {
    const c = pickLargest(creditors);
    const d = pickLargest(debtors);
    if (c === -1 || d === -1) break;
    const amount = Math.min(creditors[c].amount, debtors[d].amount);
    transfers.push({ from: debtors[d].id, to: creditors[c].id, amount });
    creditors[c].amount -= amount;
    debtors[d].amount -= amount;
  }
  return transfers;
}

/** Balances de mayor acreedor a mayor deudor (empates: orden del grupo). */
export function sortBalancesForDisplay(balances: ParticipantBalance[]): ParticipantBalance[] {
  return balances
    .map((b, index) => ({ b, index }))
    .sort((x, y) => y.b.balance - x.b.balance || x.index - y.index)
    .map(({ b }) => b);
}
