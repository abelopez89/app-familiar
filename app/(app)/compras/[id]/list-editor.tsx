"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import type {
  ProductCategory,
  ShoppingList,
  ShoppingListItem,
  ShoppingTemplate,
} from "@/lib/supabase/types";
import { addLooseItem, deleteListItem, updateItemQuantity } from "./actions";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { AddItemForm } from "./add-item-form";
import { StickyBottomBar } from "@/components/app-shell/floating-action";

const SIN_CATEGORIA = "__sin_categoria__";

/** Un ítem agregado que todavía no confirmó el servidor (id temporal). */
type LocalItem = ShoppingListItem & { pending?: boolean };

/** Espera desde el último cambio confirmado hasta refrescar en segundo plano. */
const REFRESH_DELAY_MS = 2000;

export function ListEditor({
  list,
  items,
  categories,
  templates,
  knownNames,
}: {
  list: ShoppingList;
  items: ShoppingListItem[];
  categories: ProductCategory[];
  templates: ShoppingTemplate[];
  knownNames: string[];
}) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState<LocalItem[]>(items);

  // Patrón del modo supermercado: el cambio se ve al instante, la Server
  // Action confirma en segundo plano y si falla se revierte con un toast.
  // Las acciones no revalidan; para que volver a esta pantalla (o a
  // /compras) con el botón de volver no muestre la lista vieja desde la
  // caché del router, se refresca en segundo plano un rato después del
  // último cambio confirmado — y enseguida si la persona se va antes.
  // `router.refresh()` entra a la cola del router detrás de cualquier
  // acción pendiente, así que nunca trae datos anteriores a ella.
  const [refresh] = useState(() => ({ timer: null as ReturnType<typeof setTimeout> | null }));

  const scheduleRefresh = useCallback(() => {
    if (refresh.timer) clearTimeout(refresh.timer);
    refresh.timer = setTimeout(() => {
      refresh.timer = null;
      router.refresh();
    }, REFRESH_DELAY_MS);
  }, [refresh, router]);

  useEffect(
    () => () => {
      if (!refresh.timer) return;
      clearTimeout(refresh.timer);
      refresh.timer = null;
      router.refresh();
    },
    [refresh, router],
  );

  const categoryOrder = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c, index) => map.set(c.id, index));
    return map;
  }, [categories]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, LocalItem[]>();
    for (const item of localItems) {
      const key = item.category_id ?? SIN_CATEGORIA;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(item);
    }

    return Array.from(byCategory.entries()).sort(([a], [b]) => {
      if (a === SIN_CATEGORIA) return 1;
      if (b === SIN_CATEGORIA) return -1;
      return (categoryOrder.get(a) ?? 0) - (categoryOrder.get(b) ?? 0);
    });
  }, [localItems, categoryOrder]);

  async function handleAdd(item: ShoppingListItem, formData: FormData): Promise<boolean> {
    setLocalItems((prev) => [...prev, { ...item, pending: true }]);
    const result = await addLooseItem({}, formData);
    if (result.error || !result.id) {
      toast.error(result.error ?? "No se pudo agregar el producto.");
      setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
      return false;
    }
    const id = result.id;
    setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, id, pending: false } : i)));
    scheduleRefresh();
    return true;
  }

  async function commitQuantity(item: LocalItem, quantity: number) {
    setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity } : i)));
    const result = await updateItemQuantity(item.id, quantity);
    if (result.error) {
      toast.error(result.error);
      setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity: item.quantity } : i)));
      return;
    }
    scheduleRefresh();
  }

  async function handleDelete(item: LocalItem) {
    const index = localItems.findIndex((i) => i.id === item.id);
    setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
    const result = await deleteListItem(item.id);
    if (result.error) {
      toast.error(result.error);
      // Se vuelve a poner solo este ítem (en su lugar), no una foto de toda
      // la lista: si mientras tanto se borró otro, no tiene que reaparecer.
      setLocalItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
      return;
    }
    scheduleRefresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <AddItemForm
        listId={list.id}
        categories={categories}
        templates={templates}
        knownNames={knownNames}
        onAdd={handleAdd}
      />

      {localItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta lista no tiene productos.</p>
      ) : (
        groups.map(([key, groupItems]) => (
          <div key={key} className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {key === SIN_CATEGORIA ? "Sin categoría" : groupItems[0].category_name ?? "Sin categoría"}
            </p>
            <Card>
              <CardContent className="flex flex-col divide-y p-0">
                {groupItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-4 py-2${item.pending ? " opacity-60" : ""}`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                    {/* No controlado y confirmado en onBlur (ver "Inputs
                        numéricos controlados" en CLAUDE.md). La cantidad va
                        en el key para que, si el servidor rechaza el cambio
                        y se revierte el estado, el campo se remonte con el
                        valor anterior en vez de seguir mostrando el nuevo. */}
                    <DecimalInput
                      key={`${item.id}:${item.quantity}`}
                      defaultValue={item.quantity}
                      disabled={item.pending}
                      onBlur={(e) => {
                        const parsed = Number(e.target.value);
                        if (!e.target.value || Number.isNaN(parsed) || parsed <= 0) {
                          e.target.value = String(item.quantity);
                          return;
                        }
                        if (parsed === item.quantity) return;
                        commitQuantity(item, parsed);
                      }}
                      className="h-8 w-16 text-center"
                    />
                    <span className="w-8 text-xs text-muted-foreground">{item.unit}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item)}
                      disabled={item.pending}
                      aria-label="Eliminar producto"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))
      )}

      <StickyBottomBar>
        <Button asChild size="lg" className="w-full gap-2">
          <Link href={`/compras/${list.id}/comprar`}>
            <ShoppingCart className="size-4" />
            Ir a comprar
          </Link>
        </Button>
      </StickyBottomBar>
    </div>
  );
}
