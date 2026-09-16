"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import type {
  ProductCategory,
  ShoppingList,
  ShoppingListItem,
  ShoppingTemplate,
} from "@/lib/supabase/types";
import { deleteListItem, updateItemQuantity } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { AddItemForm } from "./add-item-form";
import { StickyBottomBar } from "@/components/app-shell/floating-action";

const SIN_CATEGORIA = "__sin_categoria__";

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
  const [localItems, setLocalItems] = useState(items);

  const categoryOrder = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c, index) => map.set(c.id, index));
    return map;
  }, [categories]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, ShoppingListItem[]>();
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

  function handleQuantityChange(itemId: string, quantity: number) {
    setLocalItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
    );
  }

  async function commitQuantity(itemId: string, quantity: number) {
    const result = await updateItemQuantity(itemId, list.id, quantity);
    if (result.error) toast.error(result.error);
  }

  async function handleDelete(itemId: string) {
    const previous = localItems;
    setLocalItems((prev) => prev.filter((i) => i.id !== itemId));
    const result = await deleteListItem(itemId, list.id);
    if (result.error) {
      toast.error(result.error);
      setLocalItems(previous);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AddItemForm
        listId={list.id}
        categories={categories}
        templates={templates}
        knownNames={knownNames}
        onItemAdded={(item) => setLocalItems((prev) => [...prev, item])}
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
                  <div key={item.id} className="flex items-center gap-2 px-4 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={item.quantity}
                      onChange={(e) =>
                        handleQuantityChange(item.id, Number(e.target.value) || item.quantity)
                      }
                      onBlur={(e) => commitQuantity(item.id, Number(e.target.value) || item.quantity)}
                      className="h-8 w-16 text-center"
                    />
                    <span className="w-8 text-xs text-muted-foreground">{item.unit}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
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
