import Link from "next/link";
import { BadgePercent, Check, ClipboardList, Pencil, Plus, Receipt, ShoppingCart } from "lucide-react";
import type { ShoppingList, ShoppingListItem } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import { listItems, listProductCategories } from "@/lib/services/compras";
import { usosPorReferencia } from "@/lib/promos/usos";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGuaranies, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";

const SIN_CATEGORIA = "__sin_categoria__";

/**
 * Compras en escritorio (`lg:`): listas abiertas e historial a la izquierda
 * y la lista elegida (`?lista=<id>`; sin parámetro, la abierta más reciente
 * o la última cerrada) a la derecha, con el progreso y los productos por
 * categoría en el orden del recorrido del súper (misma agrupación que el
 * modo supermercado: `sort_order` de la categoría, "Sin categoría" al final,
 * y dentro lo que falta primero). Es de solo lectura: editar la lista, ir a
 * comprar, cerrar la compra o cargar la promo siguen en sus pantallas de
 * siempre (la edición es optimista y el modo supermercado tiene realtime;
 * no se duplica nada de eso acá).
 */
export async function ComprasEscritorio({
  familyId,
  abiertas,
  cerradas,
  selectedId,
}: {
  familyId: string;
  abiertas: ShoppingList[];
  cerradas: ShoppingList[];
  selectedId?: string;
}) {
  const selected =
    [...abiertas, ...cerradas].find((l) => l.id === selectedId) ?? abiertas[0] ?? cerradas[0] ?? null;
  const { fg, bg } = MODULES_BY_KEY.compras;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compras"
        icon={ShoppingCart}
        iconFg={fg}
        iconBg={bg}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/compras/plantillas">
                <ClipboardList className="size-4" />
                Plantillas
              </Link>
            </Button>
            <Button asChild>
              <Link href="/compras/nueva">
                <Plus className="size-4" />
                Nueva lista
              </Link>
            </Button>
          </>
        }
      />

      {!selected ? (
        <p className="hoja px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hiciste ninguna lista. Armá una a partir de tus plantillas y llevala al súper en el celular.
        </p>
      ) : (
        <div className="grid grid-cols-[18rem_minmax(0,1fr)] items-start gap-5">
          <nav className="flex flex-col gap-5" aria-label="Listas">
            {abiertas.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle>Abiertas</SectionTitle>
                {abiertas.map((list) => (
                  <ListItemLink key={list.id} list={list} active={list.id === selected.id} />
                ))}
              </section>
            )}
            {cerradas.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle>Historial</SectionTitle>
                {cerradas.map((list) => (
                  <ListItemLink key={list.id} list={list} active={list.id === selected.id} />
                ))}
              </section>
            )}
          </nav>
          <ListPanel familyId={familyId} list={selected} />
        </div>
      )}
    </div>
  );
}

function ListItemLink({ list, active }: { list: ShoppingList; active: boolean }) {
  const closed = list.status === "cerrada";
  return (
    <Link
      href={`/compras?lista=${list.id}`}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
        active ? "border-ring/40 bg-card" : "bg-card/60 hover:bg-card",
      )}
    >
      {closed ? (
        <Receipt className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ShoppingCart className="size-4 shrink-0 text-mod-compras" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{list.name ?? "Lista de compras"}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {closed
            ? list.closed_at
              ? formatDate(list.closed_at)
              : formatDate(list.shopping_date)
            : `${list.status === "en_curso" ? "Compra en curso" : "Abierta"} · ${formatDate(list.shopping_date)}`}
        </span>
      </span>
      {closed && list.total_amount != null && (
        <span className="shrink-0 text-xs font-semibold tabular-nums">{formatGuaranies(list.total_amount)}</span>
      )}
    </Link>
  );
}

async function ListPanel({ familyId, list }: { familyId: string; list: ShoppingList }) {
  const supabase = await createClient();
  const closed = list.status === "cerrada";
  const [items, categories, usos] = await Promise.all([
    listItems(supabase, familyId, list.id),
    listProductCategories(supabase, familyId),
    closed ? usosPorReferencia(familyId, "shopping_list_id", [list.id]) : Promise.resolve(new Map()),
  ]);
  const uso = usos.get(list.id);

  const order = new Map(categories.map((c, i) => [c.id, i]));
  const byCategory = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    const key = item.category_id ?? SIN_CATEGORIA;
    byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
  }
  const groups = [...byCategory.entries()]
    .sort(([a], [b]) => {
      if (a === SIN_CATEGORIA) return 1;
      if (b === SIN_CATEGORIA) return -1;
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    })
    .map(([key, groupItems]) => ({
      key,
      name: key === SIN_CATEGORIA ? "Sin categoría" : (groupItems[0].category_name ?? "Sin categoría"),
      items: [...groupItems].sort((a, b) =>
        a.is_checked !== b.is_checked ? (a.is_checked ? 1 : -1) : a.sort_order - b.sort_order,
      ),
    }));
  const checked = items.filter((i) => i.is_checked).length;
  const pct = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="flex flex-col gap-4 hoja p-5">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold">{list.name ?? "Lista de compras"}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {closed
                ? `Cerrada${list.closed_at ? ` el ${formatDateTime(list.closed_at)}` : ""}`
                : `${list.status === "en_curso" ? "Compra en curso" : "Abierta"} · ${formatDate(list.shopping_date)}`}
              {list.store ? ` · ${list.store}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {closed ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/compras/${list.id}/comprar`}>
                    <Receipt className="size-4" />
                    Ver resumen
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/promos/usar?compra=${list.id}`}>
                    <BadgePercent className="size-4" />
                    {uso ? "Cambiar promo" : "¿Pagaste con promo?"}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link href={`/compras/${list.id}`}>
                    <Pencil className="size-4" />
                    Editar lista
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`/compras/${list.id}/comprar`}>
                    <ShoppingCart className="size-4" />
                    Ir a comprar
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <Dato label="Productos" value={items.length} />
          <Dato label="Tildados" value={`${checked} de ${items.length}`} />
          <Dato
            label={closed ? "Total" : "Progreso"}
            value={closed ? (list.total_amount != null ? formatGuaranies(list.total_amount) : "—") : `${pct}%`}
          />
        </div>
        {!closed && (
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-mod-compras" style={{ width: `${pct}%` }} />
          </span>
        )}
        {closed && uso && (
          <p className="flex items-center gap-2 rounded-lg bg-mod-promos-soft px-3 py-2 text-sm text-mod-promos">
            <BadgePercent className="size-4 shrink-0" />
            <span className="min-w-0">
              {uso.promo_titulo} · {uso.tarjeta_alias} · en caja {formatGuaranies(uso.monto_caja)}
              {uso.reintegro > 0
                ? ` · reintegro ${formatGuaranies(uso.reintegro)}${uso.reintegro_acreditado ? " acreditado" : " pendiente"}`
                : ""}
            </span>
          </p>
        )}
      </section>

      <section className="hoja p-5">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">La lista está vacía.</p>
        ) : (
          <div className="columns-1 gap-8 xl:columns-2">
            {groups.map((group) => (
              <div key={group.key} className="mb-5 break-inside-avoid">
                <p className="mb-1.5 flex justify-between text-sm font-bold text-muted-foreground">
                  <span>{group.name}</span>
                  <span className="tabular-nums">
                    {group.items.filter((i) => i.is_checked).length}/{group.items.length}
                  </span>
                </p>
                <ul className="flex flex-col divide-y divide-border text-sm">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5 py-1.5">
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          item.is_checked && "border-mod-compras bg-mod-compras text-primary-foreground",
                        )}
                      >
                        {item.is_checked && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate", item.is_checked && "text-muted-foreground line-through")}>
                        {item.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatQuantity(item.quantity, item.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
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
