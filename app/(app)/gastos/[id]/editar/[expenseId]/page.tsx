import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getGroupBundle, listExpenseCategories } from "@/lib/expenses/queries";
import { exactAmountsFromShares, formatPlainDecimal } from "@/lib/expenses/split";
import { todayInFamilyTimezone } from "@/lib/dates";
import { PageHeader } from "@/components/app-shell/page-header";
import { ExpenseForm, type ExpenseInitial } from "../../expense-form";
import { DeleteExpenseButton } from "./delete-expense-button";

/**
 * Editar un gasto ya cargado — el caso típico es corregir la cotización
 * cuando llega el resumen de la tarjeta. Al guardar se vuelve a dividir
 * con el total nuevo y las partes se reescriben junto con el gasto, en la
 * misma transacción (ver `hogar.save_expense()`).
 */
export default async function EditarGastoPage({ params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id, expenseId } = await params;
  const [bundle, categories] = await Promise.all([getGroupBundle(id), listExpenseCategories()]);
  if (!bundle) notFound();

  const expense = bundle.expenses.find((e) => e.id === expenseId);
  if (!expense) notFound();

  const shares = bundle.shares.filter((s) => s.expense_id === expenseId);
  const involved = new Set([expense.paid_by, ...shares.map((s) => s.participant_id)]);
  // Activos + los inactivos que ya figuran en este gasto (si no, el editor
  // perdería su parte al guardar).
  const participants = bundle.participants.filter((p) => p.is_active || involved.has(p.id));

  const amount = Number(expense.amount);
  const rate = Number(expense.exchange_rate);
  const exacts =
    expense.split_method === "exactos"
      ? Object.fromEntries(
          exactAmountsFromShares(
            shares.map((s) => ({ participantId: s.participant_id, sharePyg: Number(s.share_pyg) })),
            amount,
            rate,
          ),
        )
      : {};

  const initial: ExpenseInitial = {
    id: expense.id,
    description: expense.description,
    amount: expense.currency === "PYG" ? String(Math.round(amount)) : formatPlainDecimal(amount),
    currency: expense.currency,
    exchangeRate: expense.currency === "PYG" ? "" : String(rate),
    categoryId: expense.category_id,
    paidBy: expense.paid_by,
    spentOn: expense.spent_on,
    paymentMethod: expense.payment_method,
    splitMethod: expense.split_method,
    splitIds: shares.map((s) => s.participant_id),
    weights: Object.fromEntries(
      participants.map((p) => {
        const share = shares.find((s) => s.participant_id === p.id);
        return [p.id, share?.weight != null ? String(Number(share.weight)) : "0"];
      }),
    ),
    exacts,
    notes: expense.notes ?? "",
    receiptDocumentId: expense.receipt_document_id,
  };

  const lastCategoryInactive = expense.category_id && !categories.find((c) => c.id === expense.category_id)?.is_active;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Editar gasto" description={bundle.group.name} />
      <ExpenseForm
        groupId={id}
        participants={participants.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          color: p.color,
          is_active: p.is_active,
        }))}
        categories={categories.filter((c) => c.is_active || (lastCategoryInactive && c.id === expense.category_id))}
        defaultRates={bundle.group.default_rates ?? {}}
        defaultCurrency={expense.currency}
        defaultPayerId={expense.paid_by}
        today={todayInFamilyTimezone()}
        initial={initial}
      />
      <DeleteExpenseButton id={expense.id} groupId={id} />
    </div>
  );
}
