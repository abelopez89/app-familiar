"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";
import { deleteExpenseGroup, setExpenseGroupStatus, updateExpenseGroup } from "../actions";
import { GroupDetailsFields } from "../group-form";
import type { ExpenseGroup } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GroupMenu({ group }: { group: ExpenseGroup }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function toggleStatus() {
    const next = group.status === "abierto" ? "cerrado" : "abierto";
    startTransition(async () => {
      const result = await setExpenseGroupStatus(group.id, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(next === "cerrado" ? "Grupo cerrado. Los balances siguen igual." : "Grupo reabierto.");
    });
  }

  function handleEdit(formData: FormData) {
    formData.set("id", group.id);
    startTransition(async () => {
      const result = await updateExpenseGroup(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Grupo actualizado.");
      setEditOpen(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpenseGroup(group.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Grupo eliminado.");
      router.push("/gastos");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-10" aria-label="Opciones del grupo">
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/gastos/${group.id}/participantes`}>Participantes</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar grupo y cotizaciones</DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onClick={toggleStatus}>
            {group.status === "abierto" ? "Cerrar (archivar)" : "Reabrir"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            Eliminar grupo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
          </DialogHeader>
          <form action={handleEdit} className="flex flex-col gap-4">
            <GroupDetailsFields group={group} />
            <p className="text-xs text-muted-foreground">
              Cambiar una cotización por defecto no toca los gastos ya cargados: cada gasto guarda la suya y se edita
              desde el propio gasto.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &quot;{group.name}&quot;?</DialogTitle>
            <DialogDescription>
              Se borran todos sus gastos y pagos registrados. No se puede deshacer. Si solo querés sacarlo de la lista,
              cerralo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
