"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ShoppingTemplate } from "@/lib/supabase/types";
import { addItemToTemplate, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LastAddedItem = {
  name: string;
  categoryId: string | null;
  quantity: number;
  unit: string;
};

export function AddToTemplateDialog({
  templates,
  item,
  onClose,
}: {
  templates: ShoppingTemplate[];
  item: LastAddedItem;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    addItemToTemplate,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success(`"${item.name}" agregado a la plantilla.`);
      setOpen(false);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
      <button type="button" className="text-primary hover:underline" onClick={() => setOpen(true)}>
        Agregar &quot;{item.name}&quot; también a una plantilla
      </button>
      <button
        type="button"
        className="text-muted-foreground"
        onClick={onClose}
        aria-label="Descartar"
      >
        ×
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar a una plantilla</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="name" value={item.name} />
            <input type="hidden" name="category_id" value={item.categoryId ?? "none"} />
            <input type="hidden" name="quantity" value={item.quantity} />
            <input type="hidden" name="unit" value={item.unit} />
            <input type="hidden" name="template_id" value={templateId} />

            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Agregando…" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
