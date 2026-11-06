import Link from "next/link";
import { AlertTriangle, HandCoins, Paperclip, Plus, Receipt, Scale, Users, Zap } from "lucide-react";
import { getGroupBundle, listExpenseCategories, type GroupSummary } from "@/lib/expenses/queries";
import { GROUP_KINDS, balanceTone, categoryIcon, describeBalance, formatOriginalAmount } from "@/lib/expenses/constants";
import { formatGuaranies } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { BalanceBars } from "./balance-bars";

function groupDates(group: GroupSummary["group"]): string | null {
  if (group.starts_on && group.ends_on) {
    return `${formatDate(group.starts_on, "d MMM")} – ${formatDate(group.ends_on, "d MMM")}`;
  }
  return group.starts_on ? formatDate(group.starts_on, "d MMM yyyy") : null;
}

/**
 * Gastos compartidos en escritorio (`lg:`): grupos a la izquierda (abiertos
 * y cerrados, con total y tu balance) y el grupo elegido (`?grupo=<id>`;
 * sin parámetro, el abierto más reciente) a la derecha, con sus balances
 * en barras, las transferencias sugeridas y la tabla de gastos. Todo sale
 * de `listGroupSummaries` y `getGroupBundle`, los mismos cálculos de
 * siempre (balances en vivo, chequeo de suma cero, `simplifyDebts`). Las
 * acciones (cargar gasto, registrar pago, editar un gasto, participantes)
 * llevan a sus pantallas de siempre: acá no hay formularios ni JS nuevo.
 */
export async function GastosEscritorio({
  summaries,
  selectedId,
  memberId,
}: {
  summaries: GroupSummary[];
  selectedId?: string;
  memberId: string;
}) {
  const open = summaries.filter((s) => s.group.status === "abierto");
  const closed = summaries.filter((s) => s.group.status === "cerrado");
  const selected =
    summaries.find((s) => s.group.id === selectedId) ?? open[0] ?? closed[0] ?? null;
  const [bundle, categories] = selected
    ? await Promise.all([getGroupBundle(selected.group.id), listExpenseCategories()])
    : [null, []];
  const { fg, bg } = MODULES_BY_KEY.gastos;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gastos"
        icon={HandCoins}
        iconFg={fg}
        iconBg={bg}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/gastos/nuevo?rapido=1">
                <Zap className="size-4" />
                Grupo rápido
              </Link>
            </Button>
            <Button asChild>
              <Link href="/gastos/nuevo">
                <Plus className="size-4" />
                Nuevo grupo
              </Link>
            </Button>
          </>
        }
      />

      {summaries.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay grupos. Un viaje, una cena con amigos: creá un grupo, cargá lo que paga cada uno y la app te
          dice quién le debe a quién.
        </p>
      ) : (
        <div className="grid grid-cols-[18rem_minmax(0,1fr)] items-start gap-5">
          {/* Grupos */}
          <nav className="flex flex-col gap-5" aria-label="Grupos">
            {open.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle>Abiertos</SectionTitle>
                {open.map((s) => (
                  <GroupItem key={s.group.id} summary={s} active={s.group.id === selected?.group.id} />
                ))}
              </section>
            )}
            {closed.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle>Cerrados</SectionTitle>
                {closed.map((s) => (
                  <GroupItem key={s.group.id} summary={s} active={s.group.id === selected?.group.id} />
                ))}
              </section>
            )}
          </nav>

          {/* Grupo elegido */}
          {selected && bundle && (
            <GroupPanel summary={selected} bundle={bundle} categories={categories} memberId={memberId} />
          )}
        </div>
      )}
    </div>
  );
}

function GroupItem({ summary, active }: { summary: GroupSummary; active: boolean }) {
  const { group, totalPyg, participantCount, expenseCount, myBalance, isConsistent } = summary;
  return (
    <Link
      href={`/gastos?grupo=${group.id}`}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 transition-colors",
        active ? "border-ring/40 bg-card" : "bg-card/60 hover:bg-card",
        group.status === "cerrado" && !active && "opacity-80",
      )}
    >
      <span className="truncate text-sm font-semibold">{group.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {[GROUP_KINDS[group.kind].label, `${participantCount} personas`, `${expenseCount} gastos`].join(" · ")}
      </span>
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums">{formatGuaranies(totalPyg)}</span>
        {!isConsistent ? (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="size-3.5" />
            Revisar
          </span>
        ) : (
          myBalance !== null && (
            <span className={cn("truncate font-medium tabular-nums", balanceTone(myBalance))}>
              {describeBalance(myBalance, formatGuaranies)}
            </span>
          )
        )}
      </span>
    </Link>
  );
}

function GroupPanel({
  summary,
  bundle,
  categories,
  memberId,
}: {
  summary: GroupSummary;
  bundle: NonNullable<Awaited<ReturnType<typeof getGroupBundle>>>;
  categories: Awaited<ReturnType<typeof listExpenseCategories>>;
  memberId: string;
}) {
  const { group } = bundle;
  const me = bundle.participants.find((p) => p.member_id === memberId);
  const myBalance = me ? (bundle.balances.balances.find((b) => b.participantId === me.id)?.balance ?? 0) : null;
  const participantsById = new Map(bundle.participants.map((p) => [p.id, p]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const { fg, bg } = MODULES_BY_KEY.gastos;
  const dates = groupDates(group);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">{group.name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {[GROUP_KINDS[group.kind].label, dates, group.status === "cerrado" ? "Cerrado" : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/gastos/${group.id}/participantes`}>
                <Users className="size-4" />
                Participantes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/gastos/${group.id}/balances`}>
                <Scale className="size-4" />
                Balances y pagos
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/gastos/${group.id}/nuevo`}>
                <Plus className="size-4" />
                Cargar gasto
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <Dato label="Total del grupo" value={formatGuaranies(bundle.totalPyg)} />
          <Dato label="Gastos" value={summary.expenseCount} />
          <Dato
            label="Tu balance"
            value={
              !bundle.balances.isConsistent ? (
                <span className="text-destructive">No cierra</span>
              ) : myBalance === null ? (
                <span className="text-muted-foreground">No participás</span>
              ) : (
                <span className={balanceTone(myBalance)}>{describeBalance(myBalance, formatGuaranies)}</span>
              )
            }
          />
        </div>
      </section>

      {/* Uno debajo del otro: lado a lado, las barras divergentes quedaban
          sin lugar entre el nombre y el importe. */}
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Balances</h3>
          <BalanceBars bundle={bundle} />
        </section>

        <section className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Gastos</h3>
          {bundle.expenses.length === 0 ? (
            <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Receipt className="size-6" />
              Sin gastos todavía.
            </p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {bundle.expenses.map((e) => {
                const category = e.category_id ? categoriesById.get(e.category_id) : undefined;
                const Icon = categoryIcon(category?.icon);
                const payer = participantsById.get(e.paid_by);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/gastos/${group.id}/editar/${e.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                    >
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", bg)}>
                        <Icon className={cn("size-4", fg)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{e.description}</span>
                          {e.receipt_document_id && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[formatDate(e.spent_on, "d MMM"), category?.name, payer ? `pagó ${payer.display_name}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">
                          {formatOriginalAmount(Number(e.amount), e.currency)}
                        </span>
                        {e.currency !== "PYG" && (
                          <span className="block text-xs tabular-nums text-muted-foreground">
                            {formatGuaranies(Number(e.amount_pyg))}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
