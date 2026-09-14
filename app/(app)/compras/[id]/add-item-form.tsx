"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { ProductCategory, ShoppingListItem, ShoppingTemplate } from "@/lib/supabase/types";
import { addLooseItem, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddToTemplateDialog } from "./add-to-template-dialog";

export function AddItemForm({
  listId,
  categories,
  templates,
  knownNames,
  onItemAdded,
}: {
  listId: string;
  categories: ProductCategory[];
  templates: ShoppingTemplate[];
  knownNames: string[];
  onItemAdded: (item: ShoppingListItem) => void;
}) {
  const [categoryId, setCategoryId] = useState("none");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("un");
  const [lastAdded, setLastAdded] = useState<{
    name: string;
    categoryId: string | null;
    quantity: number;
    unit: string;
  } | null>(null);

  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    addLooseItem,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success && state.id) {
      const category = categories.find((c) => c.id === categoryId) ?? null;
      onItemAdded({
        id: state.id,
        list_id: listId,
        family_id: "",
        template_item_id: null,
        name,
        category_id: category?.id ?? null,
        category_name: category?.name ?? null,
        quantity: Number(quantity) || 1,
        unit,
        notes: null,
        is_checked: false,
        checked_at: null,
        checked_by: null,
        unit_price: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
      });
      setLastAdded({ name, categoryId: category?.id ?? null, quantity: Number(quantity) || 1, unit });
      setName("");
      setQuantity("1");
      setUnit("un");
      setCategoryId("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="list_id" value={listId} />
        <input type="hidden" name="category_id" value={categoryId} />
        <input
          type="hidden"
          name="category_name"
          value={categories.find((c) => c.id === categoryId)?.name ?? ""}
        />

        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="new-item-name" className="sr-only">
              Producto
            </Label>
            <Input
              id="new-item-name"
              name="name"
              list="known-products"
              placeholder="Agregar producto…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <datalist id="known-products">
              {knownNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <Input
            name="quantity"
            type="number"
            min="0.5"
            step="0.5"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-16"
          />
          <Input
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-14"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-8 flex-1">
              <SelectValue placeholder="Categoría" />
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
          <Button type="submit" size="sm" disabled={pending || !name.trim()} className="gap-1">
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </form>

      {lastAdded && templates.length > 0 && (
        <AddToTemplateDialog
          templates={templates}
          item={lastAdded}
          onClose={() => setLastAdded(null)}
        />
      )}
    </div>
  );
}
