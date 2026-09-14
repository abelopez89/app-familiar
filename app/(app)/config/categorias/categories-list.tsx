"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { ProductCategory } from "@/lib/supabase/types";
import type { ActionResult } from "../actions";
import { createCategory, deleteCategory, renameCategory, reorderCategories } from "./actions";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function CategoriesList({ categories }: { categories: ProductCategory[] }) {
  const [items, setItems] = useState(categories);
  const [, startTransition] = useTransition();

  useEffect(() => setItems(categories), [categories]);

  function handleReorder(orderedIds: string[]) {
    const byId = new Map(items.map((i) => [i.id, i]));
    setItems(orderedIds.map((id) => byId.get(id)!));
    startTransition(async () => {
      const result = await reorderCategories(orderedIds);
      if (result.error) toast.error(result.error);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <NewCategoryForm />

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay categorías todavía.
            </p>
          ) : (
            <SortableList
              items={items}
              onReorder={handleReorder}
              renderItem={(category) => (
                <CategoryRow category={category} onDelete={() => handleDelete(category.id)} />
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  onDelete,
}: {
  category: ProductCategory;
  onDelete: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(renameCategory, {});
  const [name, setName] = useState(category.name);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={category.id} />
      <Input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value !== category.name) {
            e.currentTarget.form?.requestSubmit();
          }
        }}
        className="h-8"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Eliminar categoría"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </form>
  );
}

function NewCategoryForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    createCategory,
    {},
  );
  const [name, setName] = useState("");

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      setName("");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex gap-2">
      <Input
        name="name"
        placeholder="Nueva categoría"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" disabled={pending || !name.trim()} className="gap-1">
        <Plus className="size-4" />
        Agregar
      </Button>
    </form>
  );
}
