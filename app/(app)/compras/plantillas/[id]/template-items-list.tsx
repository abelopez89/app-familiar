"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { ProductCategory, ShoppingTemplate, TemplateItem } from "@/lib/supabase/types";
import { deleteTemplateItem } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "@/components/app-shell/page-header";
import { formatQuantity } from "@/lib/format";
import { TemplateItemFormDialog } from "./template-item-form-dialog";
import { MoveCopyDialog } from "./move-copy-dialog";

/**
 * Productos de una plantilla, agrupados por categoría (en el orden del
 * recorrido del súper, `sort_order`) y dentro de cada una por nombre.
 * Antes era una lista ordenada a mano con arrastrar y soltar; con muchas
 * plantillas ese orden se volvía arbitrario y costaba encontrar un
 * producto. Los que no tienen categoría van al final.
 */
export function TemplateItemsList({
  templateId,
  items,
  categories,
  otherTemplates,
}: {
  templateId: string;
  items: TemplateItem[];
  categories: ProductCategory[];
  otherTemplates: ShoppingTemplate[];
}) {
  const [localItems, setLocalItems] = useState(items);
  const [, startTransition] = useTransition();

  useEffect(() => setLocalItems(items), [items]);

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTemplateItem(id, templateId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLocalItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  const groups = useMemo(() => {
    const byName = (a: TemplateItem, b: TemplateItem) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const known = new Set(sortedCategories.map((c) => c.id));

    const result: { key: string; label: string; items: TemplateItem[] }[] = sortedCategories
      .map((c) => ({
        key: c.id,
        label: c.name,
        items: localItems.filter((i) => i.category_id === c.id).sort(byName),
      }))
      .filter((g) => g.items.length > 0);

    const uncategorized = localItems.filter((i) => !i.category_id || !known.has(i.category_id)).sort(byName);
    if (uncategorized.length > 0) result.push({ key: "none", label: "Sin categoría", items: uncategorized });
    return result;
  }, [localItems, categories]);

  return (
    <div className="flex flex-col gap-4">
      <TemplateItemFormDialog templateId={templateId} categories={categories} />

      {localItems.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            No hay productos en esta plantilla todavía.
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <SectionTitle>{group.label}</SectionTitle>
            <Card>
              <CardContent className="flex flex-col divide-y p-0">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatQuantity(item.default_quantity, item.unit)}
                      </p>
                    </div>
                    {item.is_staple && <Badge variant="secondary">Habitual</Badge>}
                    <TemplateItemFormDialog templateId={templateId} categories={categories} item={item} />
                    <MoveCopyDialog itemId={item.id} otherTemplates={otherTemplates} />
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
          </section>
        ))
      )}
    </div>
  );
}
