"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { ProductCategory, ShoppingTemplate, TemplateItem } from "@/lib/supabase/types";
import { deleteTemplateItem, reorderTemplateItems } from "../actions";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatQuantity } from "@/lib/format";
import { TemplateItemFormDialog } from "./template-item-form-dialog";
import { MoveCopyDialog } from "./move-copy-dialog";

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

  function handleReorder(orderedIds: string[]) {
    const byId = new Map(localItems.map((i) => [i.id, i]));
    setLocalItems(orderedIds.map((id) => byId.get(id)!));
    startTransition(async () => {
      const result = await reorderTemplateItems(templateId, orderedIds);
      if (result.error) toast.error(result.error);
    });
  }

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

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-4">
      <TemplateItemFormDialog templateId={templateId} categories={categories} />

      <Card>
        <CardContent className="p-0">
          {localItems.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay productos en esta plantilla todavía.
            </p>
          ) : (
            <SortableList
              items={localItems}
              onReorder={handleReorder}
              renderItem={(item) => (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatQuantity(item.default_quantity, item.unit)}
                      {item.category_id && categoryNameById.get(item.category_id)
                        ? ` · ${categoryNameById.get(item.category_id)}`
                        : ""}
                    </p>
                  </div>
                  {item.is_staple && <Badge variant="secondary">Habitual</Badge>}
                  <TemplateItemFormDialog
                    templateId={templateId}
                    categories={categories}
                    item={item}
                  />
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
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
