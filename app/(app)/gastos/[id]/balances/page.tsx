import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { getGroupBundle } from "@/lib/expenses/queries";
import { simplifyDebts, sortBalancesForDisplay } from "@/lib/expenses/settlement";
import { PAYMENT_METHODS, balanceTone, describeBalance } from "@/lib/expenses/constants";
import { formatGuaranies } from "@/lib/format";
import { formatDate, todayInFamilyTimezone } from "@/lib/dates";
import { SectionTitle } from "@/components/app-shell/page-header";
import { GroupHeader } from "../group-header";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { DeleteSettlementButton } from "./delete-settlement-button";
import { ShareSummaryButton } from "./share-summary-button";
import type { ExpensePaymentMethod } from "@/lib/supabase/types";

/**
 * Balances y clearing, calculados en vivo sobre los datos actuales — con
 * el grupo abierto y un solo gasto cargado ya se ve quién le debe a quién.
 * Antes de proponer transferencias se verifica el invariante del módulo:
 * la suma de todos los balances tiene que dar exactamente cero. Si no da,
 * se avisa en vez de mostrar números que no cierran.
 */
export default async function BalancesPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const bundle = await getGroupBundle(id);
  if (!bundle) notFound();

  const participantsById = new Map(bundle.participants.map((p) => [p.id, p]));
  const name = (pid: string) => participantsById.get(pid)?.display_name ?? "—";
  const sorted = sortBalancesForDisplay(bundle.balances.balances);
  const transfers = bundle.balances.isConsistent ? simplifyDebts(bundle.balances.balances) : [];
  const participantOptions = bundle.participants.map((p) => ({ id: p.id, display_name: p.display_name }));
  const today = todayInFamilyTimezone();

  const summary = [
    `${bundle.group.name}`,
    `Total: ${formatGuaranies(bundle.totalPyg)} (${bundle.expenses.length} gastos)`,
    "",
    "Balances:",
    ...sorted.map((b) => `• ${name(b.participantId)}: ${describeBalance(b.balance, formatGuaranies, "tercero")}`),
    "",
    transfers.length > 0 ? "Para saldar:" : "Todos están al día.",
    ...transfers.map((t) => `• ${name(t.from)} le paga a ${name(t.to)} ${formatGuaranies(t.amount)}`),
  ].join("\n");

  return (
    <div className="flex flex-col gap-6">
      <GroupHeader bundle={bundle} memberId={context.member.id} active="balances" />

      {!bundle.balances.isConsistent && (
        <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Los balances no cierran</p>
            <p className="mt-1 text-muted-foreground">
              La suma de todos los balances da {formatGuaranies(bundle.balances.sum)} y tendría que dar 0. Hay algún
              gasto con partes que no coinciden con su total: abrilo y volvé a guardarlo. Mientras tanto no se proponen
              transferencias.
            </p>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>Balance de cada uno</SectionTitle>
        <div className="flex flex-col divide-y rounded-xl border bg-card shadow-sm">
          {sorted.map((b) => {
            const p = participantsById.get(b.participantId);
            return (
              <div key={b.participantId} className="flex items-center gap-3 px-4 py-3">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p?.color ?? undefined }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {p?.display_name}
                    {p && !p.is_active && <span className="ml-1 text-xs text-muted-foreground">(inactivo)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    Pagó {formatGuaranies(b.paid)} · le toca {formatGuaranies(b.owed)}
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${balanceTone(b.balance)}`}>
                  {b.balance > 0 ? "+" : ""}
                  {formatGuaranies(b.balance)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {bundle.balances.isConsistent && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Para saldar</SectionTitle>
          {transfers.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
              <CheckCircle2 className="size-5 text-success" />
              Nadie le debe nada a nadie.
            </div>
          ) : (
            <div className="flex flex-col divide-y rounded-xl border bg-card shadow-sm">
              {transfers.map((t) => (
                <div key={`${t.from}-${t.to}`} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{name(t.from)}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate font-medium">{name(t.to)}</span>
                    <span className="ml-auto shrink-0 font-semibold tabular-nums">{formatGuaranies(t.amount)}</span>
                  </div>
                  <RecordPaymentDialog
                    groupId={id}
                    participants={participantOptions}
                    today={today}
                    defaults={{ from: t.from, to: t.to, amount: t.amount }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle
          action={<RecordPaymentDialog groupId={id} participants={participantOptions} today={today} variant="link" />}
        >
          Pagos registrados
        </SectionTitle>
        {bundle.settlements.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Todavía no se registró ningún pago.</p>
        ) : (
          <div className="flex flex-col divide-y rounded-xl border bg-card shadow-sm">
            {bundle.settlements.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {name(s.from_participant)} → {name(s.to_participant)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[
                      formatDate(s.settled_on),
                      PAYMENT_METHODS[s.payment_method as ExpensePaymentMethod]?.label ?? s.payment_method,
                      s.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatGuaranies(Number(s.amount_pyg))}</span>
                <DeleteSettlementButton id={s.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <ShareSummaryButton text={summary} title={bundle.group.name} />
    </div>
  );
}
