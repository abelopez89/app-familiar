"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ShoppingTemplate, TemplateItem } from "@/lib/supabase/types";
import { createShoppingListFromTemplates, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NewListWizard({
  templates,
  items,
}: {
  templates: ShoppingTemplate[];
  items: TemplateItem[];
}) {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
    () => new Set(templates.filter((t) => t.is_default).map((t) => t.id)),
  );
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(() => {
    const defaultTemplateIds = new Set(templates.filter((t) => t.is_default).map((t) => t.id));
    return new Set(
      items.filter((i) => defaultTemplateIds.has(i.template_id) && i.is_staple).map((i) => i.id),
    );
  });

  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    createShoppingListFromTemplates,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function toggleTemplate(templateId: string) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      const templateItems = items.filter((i) => i.template_id === templateId);

      if (next.has(templateId)) {
        next.delete(templateId);
        setCheckedItemIds((prevChecked) => {
          const nextChecked = new Set(prevChecked);
          templateItems.forEach((i) => nextChecked.delete(i.id));
          return nextChecked;
        });
      } else {
        next.add(templateId);
        setCheckedItemIds((prevChecked) => {
          const nextChecked = new Set(prevChecked);
          templateItems.forEach((i) => {
            if (i.is_staple) nextChecked.add(i.id);
          });
          return nextChecked;
        });
      }

      return next;
    });
  }

  function toggleItem(itemId: string) {
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const itemsByTemplate = useMemo(() => {
    const map = new Map<string, TemplateItem[]>();
    for (const item of items) {
      if (!map.has(item.template_id)) map.set(item.template_id, []);
      map.get(item.template_id)!.push(item);
    }
    return map;
  }, [items]);

  const selectedTemplates = templates.filter((t) => selectedTemplateIds.has(t.id));
  const totalChecked = checkedItemIds.size;

  return (
    <form action={formAction} className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Elegí una o más plantillas</p>
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => {
            const isSelected = selectedTemplateIds.has(template.id);
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => toggleTemplate(template.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background",
                )}
              >
                {template.name}
              </button>
            );
          })}
        </div>
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no tenés plantillas. Creá una en Plantillas.
          </p>
        )}
      </div>

      {selectedTemplates.map((template) => {
        const templateItems = itemsByTemplate.get(template.id) ?? [];
        if (templateItems.length === 0) return null;

        return (
          <div key={template.id} className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{template.name}</p>
            <Card>
              <CardContent className="flex flex-col divide-y p-0">
                {templateItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-14 items-center gap-3 px-4 py-2"
                  >
                    <Checkbox
                      checked={checkedItemIds.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatQuantity(item.default_quantity, item.unit)}
                      </p>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>
        );
      })}

      {selectedTemplateIds.size > 0 &&
        Array.from(selectedTemplateIds).map((id) => (
          <input key={id} type="hidden" name="templateId" value={id} />
        ))}
      {Array.from(checkedItemIds).map((id) => (
        <input key={id} type="hidden" name="itemId" value={id} />
      ))}

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-lg border-t bg-background px-4 py-3">
        <Button type="submit" className="w-full" size="lg" disabled={pending || totalChecked === 0}>
          {pending ? "Creando…" : `Crear lista (${totalChecked})`}
        </Button>
      </div>
    </form>
  );
}
