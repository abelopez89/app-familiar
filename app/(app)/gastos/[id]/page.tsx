import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Paperclip, Plus, Receipt } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { getGroupBundle, listExpenseCategories } from "@/lib/expenses/queries";
import { categoryIcon, formatOriginalAmount } from "@/lib/expenses/constants";
import { formatGuaranies } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle } from "@/components/app-shell/page-header";
import { FloatingAction } from "@/components/app-shell/floating-action";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import type { Expense } from "@/lib/supabase/types";
import { GroupHeader } from "./group-header";

export default async function GrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const [bundle, categories] = await Promise.all([getGroupBundle(id), listExpenseCategories()]);
  if (!bundle) notFound();

  const participantsById = new Map(bundle.participants.map((p) => [p.id, p]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const { fg, bg } = MODULES_BY_KEY.gastos;

  // Cronológica (más nuevos primero), agrupada por día.
  const byDay = new Map<string, Expense[]>();
  for (const e of bundle.expenses) {
    const list = byDay.get(e.spent_on) ?? [];
    list.push(e);
    byDay.set(e.spent_on, list);
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <GroupHeader bundle={bundle} memberId={context.member.id} active="gastos" />

      {bundle.expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos todavía"
          description="Cargá el primero: los balances se calculan desde el primer gasto."
          action={
            <Button asChild>
              <Link href={`/gastos/${id}/nuevo`}>Cargar gasto</Link>
            </Button>
          }
        />
      ) : (
        [...byDay.entries()].map(([day, expenses]) => (
          <section key={day} className="flex flex-col gap-2">
            <SectionTitle>{formatDate(day, "EEEE d 'de' MMMM")}</SectionTitle>
            <div className="flex flex-col divide-y rounded-xl border bg-card shadow-sm">
              {expenses.map((e) => {
                const category = e.category_id ? categoriesById.get(e.category_id) : undefined;
                const Icon = categoryIcon(category?.icon);
                const payer = participantsById.get(e.paid_by);
                return (
                  <Link
                    key={e.id}
                    href={`/gastos/${id}/editar/${e.id}`}
                    className="tap-target flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted"
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                      <Icon className={`size-4.5 ${fg}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{e.description}</span>
                        {e.receipt_document_id && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[category?.name, payer ? `pagó ${payer.display_name}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">
                        {formatOriginalAmount(Number(e.amount), e.currency)}
                      </span>
                      {e.currency !== "PYG" && (
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {formatGuaranies(Number(e.amount_pyg))}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}

      <FloatingAction>
        <Button asChild size="icon" className="size-14 rounded-full shadow-lg">
          <Link href={`/gastos/${id}/nuevo`} aria-label="Cargar gasto">
            <Plus className="size-6" />
          </Link>
        </Button>
      </FloatingAction>
    </div>
  );
}
