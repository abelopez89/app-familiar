"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreVertical, Plus } from "lucide-react";
import { createDocumentCategory, deleteDocumentCategory, updateDocumentCategory, type ActionResult } from "./actions";
import { DOCUMENT_CATEGORY_KINDS } from "@/lib/documents/constants";
import type { DocumentCategory, DocumentCategoryKind } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function CategoryFormDialog({ category }: { category?: DocumentCategory }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DocumentCategoryKind>(category?.kind ?? "general");
  const action = category ? updateDocumentCategory : createDocumentCategory;
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
          <input type="hidden" name="kind" value={kind} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={category?.name} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DocumentCategoryKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DOCUMENT_CATEGORY_KINDS) as DocumentCategoryKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {DOCUMENT_CATEGORY_KINDS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export function CategoriesList({ categories }: { categories: DocumentCategory[] }) {
  const [items, setItems] = useState(categories);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteDocumentCategory(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((c) => c.id !== id));
      toast.success("Categoría eliminada.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CategoryFormDialog />
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No hay categorías todavía.</p>
          )}
          {items.map((category) => (
            <div key={category.id} className="flex items-center gap-3 p-4">
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{category.name}</span>
                <span className="text-xs text-muted-foreground">{DOCUMENT_CATEGORY_KINDS[category.kind].label}</span>
              </div>
              <CategoryFormDialog category={category} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => handleDelete(category.id)}
                  >
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
