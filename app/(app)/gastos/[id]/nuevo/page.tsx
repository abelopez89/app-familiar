import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getGroupBundle, listExpenseCategories } from "@/lib/expenses/queries";
import { todayInFamilyTimezone } from "@/lib/dates";
import { PageHeader } from "@/components/app-shell/page-header";
import { ExpenseForm } from "../expense-form";

export default async function NuevoGastoPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const [bundle, categories] = await Promise.all([getGroupBundle(id), listExpenseCategories()]);
  if (!bundle) notFound();

  const active = bundle.participants.filter((p) => p.is_active);
  if (active.length === 0) redirect(`/gastos/${id}/participantes`);

  // Por defecto paga quien está cargando; si no participa, el primero.
  const me = active.find((p) => p.member_id === context.member.id);
  // La moneda se recuerda por grupo: la del último gasto cargado.
  const lastCreated = [...bundle.expenses].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Nuevo gasto" description={bundle.group.name} />
      <ExpenseForm
        groupId={id}
        participants={active.map((p) => ({ id: p.id, display_name: p.display_name, color: p.color, is_active: true }))}
        categories={categories.filter((c) => c.is_active)}
        defaultRates={bundle.group.default_rates ?? {}}
        defaultCurrency={lastCreated?.currency ?? "PYG"}
        defaultPayerId={(me ?? active[0]).id}
        today={todayInFamilyTimezone()}
      />
    </div>
  );
}
