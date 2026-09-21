import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Plus, Receipt, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";

export default async function ComprasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();

  const [{ data: openLists }, { data: closedLists }] = await Promise.all([
    supabase
      .from("shopping_lists")
      .select("*")
      .in("status", ["abierta", "en_curso"])
      .order("created_at", { ascending: false }),
    supabase
      .from("shopping_lists")
      .select("*")
      .eq("status", "cerrada")
      .order("closed_at", { ascending: false })
      .limit(10),
  ]);

  const { fg, bg } = MODULES_BY_KEY.compras;
  const abiertas = openLists ?? [];
  const cerradas = closedLists ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compras"
        icon={ShoppingCart}
        iconFg={fg}
        iconBg={bg}
        actions={
          <Button variant="ghost" size="icon" asChild className="size-10">
            <Link href="/compras/plantillas" aria-label="Plantillas">
              <ClipboardList className="size-5" />
            </Link>
          </Button>
        }
      />

      <Button asChild size="lg" className="gap-2">
        <Link href="/compras/nueva">
          <Plus className="size-4" />
          Nueva lista de compras
        </Link>
      </Button>

      {abiertas.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Abiertas</SectionTitle>
          <div className="flex flex-col gap-2">
            {abiertas.map((list) => (
              <Link
                key={list.id}
                href={`/compras/${list.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-transform duration-150 active:scale-[0.99]"
              >
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                  <ShoppingCart className={`size-5 ${fg}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {list.name ?? "Lista de compras"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {list.status === "en_curso" ? "Compra en curso" : "Abierta"} ·{" "}
                    {formatDate(list.shopping_date)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {abiertas.length === 0 && cerradas.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title="Todavía no hiciste ninguna lista"
          description="Armá una a partir de tus plantillas y llevala al súper en el celular."
        />
      )}

      {cerradas.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Historial</SectionTitle>
          <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card shadow-sm">
            {cerradas.map((list) => (
              <Link
                key={list.id}
                href={`/compras/${list.id}/comprar`}
                className="tap-target flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted/50"
              >
                <Receipt className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {list.name ?? "Lista de compras"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {list.closed_at
                      ? formatDateTime(list.closed_at)
                      : formatDate(list.shopping_date)}
                  </p>
                </div>
                {list.total_amount != null && (
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatGuaranies(list.total_amount)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
