// División de un gasto entre participantes (Fase 6). Funciones puras,
// sin dependencias de React ni de Supabase — mismo criterio que
// lib/tasks/schedule.ts y lib/fuel/consumption.ts.
//
// Regla que sostiene todo el módulo: los guaraníes no tienen decimales,
// así que cada parte es un ENTERO y la suma de las partes es EXACTAMENTE
// el `amount_pyg` del gasto. Si se redondeara cada parte por separado
// (10.000 / 3 → 3.333 + 3.333 + 3.333 = 9.999), el guaraní perdido se
// acumula gasto tras gasto y el clearing de un viaje nunca cierra en
// cero. El resto de cada división se reparte de a 1 Gs de forma
// determinística, siguiendo el orden de la lista que se recibe (que es
// siempre el `sort_order` de los participantes del grupo).
//
// Se trabaja con BigInt en los cálculos intermedios: importe × peso puede
// pasar 2^53 con un gasto grande y pesos con decimales, y un error de
// punto flotante acá es exactamente el tipo de guaraní fantasma que este
// archivo existe para evitar.

export const MAX_AMOUNT_DECIMALS = 2; // numeric(14,2) en expenses.amount
export const MAX_RATE_DECIMALS = 6; // numeric(14,6) en expenses.exchange_rate

/**
 * Convierte un decimal escrito como texto ("100.5", "1450") a un entero
 * escalado por 10^decimals, sin pasar por float. Devuelve null si el
 * texto no es un número positivo o tiene más decimales de los que la
 * columna puede guardar (la base los redondearía en silencio y el
 * `amount_pyg` calculado acá dejaría de coincidir con el de la base).
 */
export function parseScaledDecimal(raw: string | number, decimals: number): bigint | null {
  const text = String(raw).trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return null;
  return BigInt(match[1] + fraction.padEnd(decimals, "0"));
}

/**
 * `amount_pyg` de un gasto, calculado igual que la columna generada de
 * la base: `round(amount * exchange_rate)`, con el redondeo de `numeric`
 * de Postgres (mitad hacia arriba, para positivos). Se usa para la vista
 * previa en vivo del formulario y para armar las partes antes de
 * guardar; `hogar.save_expense()` rechaza el gasto si las partes no
 * suman lo mismo que calculó la base, así que una diferencia acá no
 * puede terminar guardada.
 */
export function toAmountPyg(amount: string | number, rate: string | number): number | null {
  const a = parseScaledDecimal(amount, MAX_AMOUNT_DECIMALS);
  const r = parseScaledDecimal(rate, MAX_RATE_DECIMALS);
  if (a === null || r === null || a <= BigInt(0) || r <= BigInt(0)) return null;
  const scale = BigInt(10) ** BigInt(MAX_AMOUNT_DECIMALS + MAX_RATE_DECIMALS);
  const product = a * r;
  return Number((product + scale / BigInt(2)) / scale);
}

export type Share = { participantId: string; sharePyg: number; weight: number | null };

/**
 * Reparto proporcional con resto determinístico (método del mayor
 * resto). Cada participante recibe `floor(total × peso / suma)`, y los
 * guaraníes que sobran van de a uno a quienes tuvieron la mayor parte
 * fraccionaria; si empatan, al que aparece primero en la lista. Con pesos
 * iguales esto es exactamente "el resto a los primeros participantes".
 *
 * Garantiza: todas las partes son enteros ≥ 0 y suman exactamente `total`.
 */
function apportion(total: number, weights: { participantId: string; weight: bigint }[]): Map<string, number> {
  const totalBig = BigInt(total);
  const sum = weights.reduce((acc, w) => acc + w.weight, BigInt(0));
  if (sum <= BigInt(0)) throw new Error("La suma de los pesos tiene que ser mayor a cero.");

  const rows = weights.map((w, index) => {
    const numerator = totalBig * w.weight;
    return { participantId: w.participantId, index, base: numerator / sum, remainder: numerator % sum };
  });

  let leftover = totalBig - rows.reduce((acc, r) => acc + r.base, BigInt(0));
  const byRemainder = [...rows].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  const extra = new Set<number>();
  for (const row of byRemainder) {
    if (leftover <= BigInt(0)) break;
    extra.add(row.index);
    leftover -= BigInt(1);
  }

  return new Map(rows.map((r) => [r.participantId, Number(r.base) + (extra.has(r.index) ? 1 : 0)]));
}

/** Partes iguales entre los participantes elegidos (en el orden recibido). */
export function splitEqual(totalPyg: number, participantIds: string[]): Share[] {
  if (participantIds.length === 0) throw new Error("Elegí al menos una persona.");
  const parts = apportion(
    totalPyg,
    participantIds.map((participantId) => ({ participantId, weight: BigInt(1) })),
  );
  return participantIds.map((participantId) => ({
    participantId,
    sharePyg: parts.get(participantId)!,
    weight: null,
  }));
}

/**
 * Por partes: cada uno con su peso ("la pareja cuenta doble"). Los pesos
 * con peso 0 no generan fila — quien no participa del gasto no tiene
 * parte, igual que en partes iguales.
 */
export function splitByWeights(totalPyg: number, weights: { participantId: string; weight: string | number }[]): Share[] {
  const parsed = weights
    .map((w) => ({ participantId: w.participantId, weight: parseScaledDecimal(w.weight, 2), raw: w.weight }))
    .filter((w) => w.weight !== null && w.weight > BigInt(0)) as { participantId: string; weight: bigint; raw: string | number }[];
  if (parsed.length === 0) throw new Error("Poné al menos un peso mayor a cero.");
  const parts = apportion(totalPyg, parsed);
  return parsed.map((w) => ({
    participantId: w.participantId,
    sharePyg: parts.get(w.participantId)!,
    weight: Number(w.weight) / 100,
  }));
}

export type ExactCheck =
  | { ok: true }
  | { ok: false; difference: number; /** en la moneda del gasto */ assigned: number };

/**
 * Importes exactos: cada uno pone lo suyo, en la MONEDA DEL GASTO (el
 * menú está en reales, no en guaraníes). Primero se valida que sumen
 * exactamente el importe del ticket — si no, no se guarda y se muestra la
 * diferencia —, y recién después se reparte el `amount_pyg` en proporción
 * a esos importes. En guaraníes eso da las partes tal cual se escribieron;
 * en otra moneda, la conversión de cada parte respeta la suma exacta.
 */
export function checkExactAmounts(amount: string | number, exacts: { amount: string | number }[]): ExactCheck {
  const total = parseScaledDecimal(amount, MAX_AMOUNT_DECIMALS);
  if (total === null) return { ok: false, difference: 0, assigned: 0 };
  let assigned = BigInt(0);
  for (const e of exacts) {
    const raw = String(e.amount).trim();
    if (raw === "") continue;
    const value = parseScaledDecimal(raw, MAX_AMOUNT_DECIMALS);
    if (value === null) return { ok: false, difference: 0, assigned: 0 };
    assigned += value;
  }
  if (assigned === total) return { ok: true };
  const cents = 10 ** MAX_AMOUNT_DECIMALS;
  return { ok: false, difference: Number(total - assigned) / cents, assigned: Number(assigned) / cents };
}

export function splitExact(
  totalPyg: number,
  amount: string | number,
  exacts: { participantId: string; amount: string | number }[],
): Share[] {
  const check = checkExactAmounts(amount, exacts);
  if (!check.ok) throw new Error("Los importes no suman el total del gasto.");
  const parsed = exacts
    .map((e) => ({
      participantId: e.participantId,
      weight: String(e.amount).trim() === "" ? BigInt(0) : parseScaledDecimal(e.amount, MAX_AMOUNT_DECIMALS)!,
    }))
    .filter((e) => e.weight > BigInt(0));
  const parts = apportion(totalPyg, parsed);
  return parsed.map((e) => ({ participantId: e.participantId, sharePyg: parts.get(e.participantId)!, weight: null }));
}

/**
 * Importes exactos para reabrir el editor de un gasto guardado, en la
 * moneda del gasto. En guaraníes es la parte tal cual. En otra moneda se
 * deshace la conversión (parte / cotización, a centavos) y el centavo que
 * pueda sobrar o faltar por redondeo se le ajusta a la parte más grande,
 * para que el editor abra ya cuadrado contra el importe del ticket.
 */
export function exactAmountsFromShares(
  shares: { participantId: string; sharePyg: number }[],
  amount: number,
  rate: number,
): Map<string, string> {
  const cents = 10 ** MAX_AMOUNT_DECIMALS;
  const values = shares.map((s) => ({ id: s.participantId, cents: Math.round((s.sharePyg / rate) * cents) }));
  const target = Math.round(amount * cents);
  const diff = target - values.reduce((acc, v) => acc + v.cents, 0);
  if (diff !== 0 && values.length > 0) {
    const largest = values.reduce((a, b) => (b.cents > a.cents ? b : a));
    largest.cents += diff;
  }
  return new Map(values.map((v) => [v.id, formatPlainDecimal(v.cents / cents)]));
}

/** Número a texto con punto decimal y sin ceros sobrantes ("12.5", "100"). */
export function formatPlainDecimal(value: number): string {
  return value.toFixed(MAX_AMOUNT_DECIMALS).replace(/\.?0+$/, "");
}
