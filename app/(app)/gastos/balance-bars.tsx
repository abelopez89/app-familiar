import { AlertTriangle } from "lucide-react";
import type { GroupBundle } from "@/lib/expenses/queries";
import { balanceTone } from "@/lib/expenses/constants";
import { simplifyDebts, sortBalancesForDisplay } from "@/lib/expenses/settlement";
import { formatGuaranies } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Balances de un grupo en barras divergentes (debe a la izquierda, le
 * deben a la derecha) y las transferencias de `simplifyDebts` para quedar
 * a mano. Server Component sin JS. Lo usan el tablero del inicio y
 * `/gastos` en escritorio. Mismo criterio que `/gastos/[id]/balances`: si
 * la suma no da cero se avisa y no se proponen transferencias (regla 11
 * de la Fase 6).
 */
export function BalanceBars({ bundle }: { bundle: GroupBundle }) {
  const names = new Map(bundle.participants.map((p) => [p.id, p.display_name]));
  const balances = sortBalancesForDisplay(bundle.balances.balances);
  const maxAbs = Math.max(1, ...balances.map((b) => Math.abs(b.balance)));
  const transfers = bundle.balances.isConsistent ? simplifyDebts(bundle.balances.balances) : [];

  return (
    <>
      {!bundle.balances.isConsistent && (
        <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          Los balances no suman cero (diferencia {formatGuaranies(bundle.balances.sum)}). Revisá el grupo.
        </p>
      )}
      <ul className="flex flex-col gap-2 text-sm">
        {balances.map((b) => {
          const width = `${(Math.abs(b.balance) / maxAbs) * 100}%`;
          return (
            <li key={b.participantId} className="grid grid-cols-[7rem_1fr_7.5rem] items-center gap-3">
              <span className="truncate">{names.get(b.participantId) ?? "—"}</span>
              <span className="grid h-2.5 grid-cols-2">
                <span className="flex justify-end border-r border-border">
                  {b.balance < 0 && <span className="h-full rounded-l-full bg-destructive" style={{ width }} />}
                </span>
                <span className="flex">
                  {b.balance > 0 && <span className="h-full rounded-r-full bg-success" style={{ width }} />}
                </span>
              </span>
              <span className={cn("text-right text-xs font-medium tabular-nums", balanceTone(b.balance))}>
                {b.balance > 0 ? "+" : b.balance < 0 ? "−" : ""}
                {formatGuaranies(Math.abs(b.balance))}
              </span>
            </li>
          );
        })}
      </ul>
      {transfers.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Para quedar a mano</p>
          <ul className="flex flex-col gap-1 text-sm">
            {transfers.map((t, i) => (
              <li key={i}>
                <span className="font-medium">{names.get(t.from)}</span> le paga{" "}
                <span className="font-medium tabular-nums">{formatGuaranies(t.amount)}</span> a{" "}
                <span className="font-medium">{names.get(t.to)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
