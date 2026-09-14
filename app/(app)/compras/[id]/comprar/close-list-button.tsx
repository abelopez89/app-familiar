"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { closeShoppingList, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CloseListButton({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false);
  const closeWithListId = closeShoppingList.bind(null, listId);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    closeWithListId,
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full gap-2">
          <CheckCircle2 className="size-4" />
          Cerrar compra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar compra</DialogTitle>
          <DialogDescription>
            El total del ticket es opcional. Podés dejarlo en blanco.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="total_amount">Total (Gs.)</Label>
            <Input
              id="total_amount"
              name="total_amount"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="Opcional"
            />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Cerrando…" : "Confirmar y cerrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
