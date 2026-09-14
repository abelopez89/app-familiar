"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { ProductCategory, TemplateItem } from "@/lib/supabase/types";
import { createTemplateItem, updateTemplateItem, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export function TemplateItemFormDialog({
  templateId,
  categories,
  item,
}: {
  templateId: string;
  categories: ProductCategory[];
  item?: TemplateItem;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "none");
  const action = item ? updateTemplateItem : createTemplateItem;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="sm">
            Editar
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="size-4" />
            Agregar producto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="template_id" value={templateId} />
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="category_id" value={categoryId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={item?.name} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="default_quantity">Cantidad</Label>
              <Input
                id="default_quantity"
                name="default_quantity"
                type="number"
                step="0.5"
                min="0.5"
                defaultValue={item?.default_quantity ?? 1}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unit">Unidad</Label>
              <Input id="unit" name="unit" defaultValue={item?.unit ?? "un"} required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input id="notes" name="notes" defaultValue={item?.notes ?? ""} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_staple">Tildado por defecto al generar lista</Label>
            <Switch id="is_staple" name="is_staple" defaultChecked={item?.is_staple ?? true} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
