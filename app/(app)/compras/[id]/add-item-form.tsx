"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { ProductCategory, ShoppingListItem, ShoppingTemplate } from "@/lib/supabase/types";
import { defaultProductCategoryId } from "@/lib/normalize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
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
  onAdd,
}: {
  listId: string;
  categories: ProductCategory[];
  templates: ShoppingTemplate[];
  knownNames: string[];
  /** Agrega el ítem al instante y lo confirma; resuelve en false si falló. */
  onAdd: (item: ShoppingListItem, formData: FormData) => Promise<boolean>;
}) {
  const defaultCategoryId = defaultProductCategoryId(categories) ?? "none";
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("un");
  const [lastAdded, setLastAdded] = useState<{
    name: string;
    categoryId: string | null;
    quantity: number;
    unit: string;
  } | null>(null);

  // Optimista: el producto aparece en la lista y el formulario queda
  // libre para el siguiente apenas se toca "Agregar", sin esperar al
  // servidor. El id temporal se reemplaza por el real al confirmar; si
  // falla, la lista lo saca y avisa (ver `handleAdd` en list-editor.tsx).
  // `onSubmit` y no `<form action>`: una acción de formulario corre dentro
  // de una transición, y React no pinta sus cambios de estado hasta que
  // termina el await — el producto aparecería recién con la respuesta.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const trimmed = name.trim();
    if (!trimmed) return;
    const category = categories.find((c) => c.id === categoryId) ?? null;
    const added = { name: trimmed, categoryId: category?.id ?? null, quantity: Number(quantity) || 1, unit };

    setName("");
    setQuantity("1");
    setUnit("un");
    setCategoryId(defaultCategoryId);

    const ok = await onAdd(
      {
        id: `tmp-${crypto.randomUUID()}`,
        list_id: listId,
        family_id: "",
        template_item_id: null,
        name: trimmed,
        category_id: added.categoryId,
        category_name: category?.name ?? null,
        quantity: added.quantity,
        unit,
        notes: null,
        is_checked: false,
        checked_at: null,
        checked_by: null,
        unit_price: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
      },
      formData,
    );
    // "Agregar también a una plantilla" solo para lo que sí se guardó. Si
    // falló, el nombre vuelve al campo (salvo que ya se esté escribiendo
    // otro) para reintentar sin tipearlo de nuevo.
    if (ok) setLastAdded(added);
    else setName((current) => current || trimmed);
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
          <DecimalInput
            name="quantity"
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
          <Button type="submit" size="sm" disabled={!name.trim()} className="gap-1">
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
