"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreVertical, Plus, Sparkles } from "lucide-react";
import {
  addSuggestedExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  setExpenseCategoryActive,
  updateExpenseCategory,
  type ActionResult,
} from "./actions";
import { CATEGORY_ICON_OPTIONS, SUGGESTED_CATEGORIES, categoryIcon } from "@/lib/expenses/constants";
import type { ExpenseCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function CategoryFormDialog({ category }: { category?: ExpenseCategory }) {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const action = category ? updateExpenseCategory : createExpenseCategory;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      toast.success(category ? "Categoría actualizada." : "Categoría creada.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, category]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="sm">
            Editar
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="size-4" />
            Nueva categoría
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {category && <input type="hidden" name="id" value={category.id} />}
          <input type="hidden" name="icon" value={icon} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={category?.name} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Ícono</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICON_OPTIONS.map((name) => {
                const Icon = categoryIcon(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    aria-pressed={icon === name}
                    aria-label={name}
                    className={cn(
                      "tap-target flex size-11 items-center justify-center rounded-lg border",
                      icon === name ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </button>
                );
              })}
            </div>
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

export function ExpenseCategoriesList({ categories }: { categories: ExpenseCategory[] }) {
  const [isPending, startTransition] = useTransition();
  const existing = new Set(categories.map((c) => c.name.toLowerCase()));
  const missingSuggested = SUGGESTED_CATEGORIES.filter((c) => !existing.has(c.name.toLowerCase()));

  function run(action: () => Promise<ActionResult>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(message);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        {missingSuggested.length > 0 && (
          <Button
            variant="outline"
            className="gap-2"
            disabled={isPending}
            onClick={() => run(addSuggestedExpenseCategories, "Categorías sugeridas agregadas.")}
          >
            <Sparkles className="size-4" />
            Agregar sugeridas ({missingSuggested.length})
          </Button>
        )}
        <CategoryFormDialog />
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {categories.length === 0 && <p className="p-4 text-sm text-muted-foreground">No hay categorías todavía.</p>}
          {categories.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <div key={category.id} className="flex items-center gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-mod-gastos-soft">
                  <Icon className="size-4.5 text-mod-gastos" />
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-medium">{category.name}</span>
                  {!category.is_active && <Badge variant="outline">Oculta</Badge>}
                </div>
                <CategoryFormDialog category={category} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Más opciones">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={isPending}
                      onClick={() =>
                        run(
                          () => setExpenseCategoryActive(category.id, !category.is_active),
                          category.is_active ? "Categoría oculta." : "Categoría visible.",
                        )
                      }
                    >
                      {category.is_active ? "Ocultar" : "Mostrar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => run(() => deleteExpenseCategory(category.id), "Categoría eliminada.")}
                    >
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <p className="px-1 text-xs text-muted-foreground">
        Eliminar una categoría deja sin categoría a los gastos que la usaban; ocultarla solo la saca de los chips.
      </p>
    </div>
  );
}
