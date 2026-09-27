import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ChevronRight, HandCoins, Plus, Zap } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listGroupSummaries, type GroupSummary } from "@/lib/expenses/queries";
import { GROUP_KINDS, balanceTone, describeBalance } from "@/lib/expenses/constants";
import { formatGuaranies } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";

/**
 * Gastos compartidos: repartir gastos entre varias personas y saber quién
 * le debe cuánto a quién. No es un control de gastos personales ni un
 * presupuesto. Grupos abiertos arriba con el balance de quien mira — el
 * número que uno quiere ver de un vistazo —, los cerrados (archivados)
 * abajo.
 */
export default async function GastosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const summaries = await listGroupSummaries(context.member.id);
  const open = summaries.filter((s) => s.group.status === "abierto");
  const closed = summaries.filter((s) => s.group.status === "cerrado");
  const { fg, bg } = MODULES_BY_KEY.gastos;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Gastos compartidos" icon={HandCoins} iconFg={fg} iconBg={bg} />

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-12 gap-2">
          <Link href="/gastos/nuevo?rapido=1">
            <Zap className="size-4" />
            Grupo rápido
          </Link>
        </Button>
        <Button asChild className="h-12 gap-2">
          <Link href="/gastos/nuevo">
            <Plus className="size-4" />
            Nuevo grupo
          </Link>
        </Button>
      </div>

      {summaries.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Todavía no hay grupos"
          description="Un viaje, una cena con amigos: creá un grupo, cargá lo que paga cada uno y la app te dice quién le debe a quién."
        />
      ) : (
        <>
          {open.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>Abiertos</SectionTitle>
              <div className="flex flex-col gap-2">
                {open.map((s) => (
                  <GroupCard key={s.group.id} summary={s} />
                ))}
              </div>
            </section>
          )}
          {closed.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>Cerrados</SectionTitle>
              <div className="flex flex-col gap-2 opacity-80">
                {closed.map((s) => (
                  <GroupCard key={s.group.id} summary={s} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function GroupCard({ summary }: { summary: GroupSummary }) {
  const { group, totalPyg, expenseCount, participantCount, myBalance, isConsistent } = summary;
  const dates =
    group.starts_on && group.ends_on
      ? `${formatDate(group.starts_on, "d MMM")} – ${formatDate(group.ends_on, "d MMM")}`
      : group.starts_on
        ? formatDate(group.starts_on, "d MMM yyyy")
        : null;

  return (
    <Link
      href={`/gastos/${group.id}`}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{group.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[GROUP_KINDS[group.kind].label, dates, `${participantCount} personas`, `${expenseCount} gastos`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium tabular-nums">{formatGuaranies(totalPyg)}</span>
          {!isConsistent ? (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="size-3.5" />
              Revisar balances
            </span>
          ) : (
            myBalance !== null && (
              <span className={`text-sm font-medium tabular-nums ${balanceTone(myBalance)}`}>
                {describeBalance(myBalance, formatGuaranies)}
              </span>
            )
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
