"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProductCategory, ShoppingListItem } from "@/lib/supabase/types";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toggleItemChecked } from "./actions";
import { CloseListButton } from "./close-list-button";

const SIN_CATEGORIA = "__sin_categoria__";

export function SupermercadoView({
  listId,
  initialItems,
  categories,
}: {
  listId: string;
  initialItems: ShoppingListItem[];
  categories: ProductCategory[];
}) {
  const [items, setItems] = useState(initialItems);
  const pendingIds = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let released = false;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Degradar silenciosamente si el navegador no lo soporta o lo niega.
      }
    }

    requestWakeLock();

    function handleVisibilityChange() {
      if (!released && document.visibilityState === "visible") {
        requestWakeLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`shopping_list_items_${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "hogar",
          table: "shopping_list_items",
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as ShoppingListItem;
            if (pendingIds.current.has(updated.id)) return;
            setItems((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item)),
            );
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as ShoppingListItem;
            setItems((prev) =>
              prev.some((i) => i.id === inserted.id) ? prev : [...prev, inserted],
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setItems((prev) => prev.filter((i) => i.id !== deletedId));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId]);

  const categoryOrder = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c, index) => map.set(c.id, index));
    return map;
  }, [categories]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const key = item.category_id ?? SIN_CATEGORIA;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(item);
    }

    for (const groupItems of byCategory.values()) {
      groupItems.sort((a, b) => {
        if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;
        return a.sort_order - b.sort_order;
      });
    }

    return Array.from(byCategory.entries()).sort(([a], [b]) => {
      if (a === SIN_CATEGORIA) return 1;
      if (b === SIN_CATEGORIA) return -1;
      return (categoryOrder.get(a) ?? 0) - (categoryOrder.get(b) ?? 0);
    });
  }, [items, categoryOrder]);

  const totalCount = items.length;
  const checkedCount = items.filter((i) => i.is_checked).length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((checkedCount / totalCount) * 100);

  function handleToggle(item: ShoppingListItem) {
    const nextChecked = !item.is_checked;
    pendingIds.current.add(item.id);

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              is_checked: nextChecked,
              checked_at: nextChecked ? new Date().toISOString() : null,
            }
          : i,
      ),
    );

    toggleItemChecked(item.id, nextChecked)
      .then((result) => {
        if (result.error) {
          toast.error(result.error);
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, is_checked: item.is_checked } : i)),
          );
        }
      })
      .finally(() => {
        pendingIds.current.delete(item.id);
      });
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="sticky top-0 z-20 -mx-4 bg-background px-4 pb-3 pt-1">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>
            {checkedCount} de {totalCount}
          </span>
          <span className="text-sm font-normal text-muted-foreground">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {groups.map(([key, groupItems]) => {
        const groupChecked = groupItems.filter((i) => i.is_checked).length;
        const categoryLabel =
          key === SIN_CATEGORIA
            ? "Sin categoría"
            : groupItems[0].category_name ?? "Sin categoría";

        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-1">
              <p className="text-base font-semibold">{categoryLabel}</p>
              <p className="text-sm text-muted-foreground">
                {groupChecked}/{groupItems.length}
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <AnimatePresence initial={false}>
                {groupItems.map((item) => (
                  <motion.button
                    key={item.id}
                    layout
                    type="button"
                    onClick={() => handleToggle(item)}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 border-b bg-background px-4 py-3 text-left last:border-b-0 active:bg-muted",
                      item.is_checked && "bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                        item.is_checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {item.is_checked && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">
                      <span
                        className={cn(
                          "block text-lg font-medium",
                          item.is_checked && "text-muted-foreground line-through",
                        )}
                      >
                        {item.name}
                      </span>
                      {item.notes && (
                        <span className="block text-sm text-muted-foreground">{item.notes}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-base text-muted-foreground">
                      {formatQuantity(item.quantity, item.unit)}
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-lg border-t bg-background px-4 py-3">
        <CloseListButton listId={listId} />
      </div>
    </div>
  );
}
