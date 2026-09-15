"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeTaskInstance, skipTaskInstance } from "./actions";
import type { TaskInstanceWithDetails } from "@/lib/tasks/queries";
import { todayInFamilyTimezone } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TaskCompleteDialog({
  instance,
  trigger,
  onCompleted,
  onSkipped,
}: {
  instance: TaskInstanceWithDetails;
  trigger: React.ReactNode;
  onCompleted: () => void;
  onSkipped: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleComplete(formData: FormData) {
    startTransition(async () => {
      const completedAt = formData.get("completed_at");
      const notes = formData.get("notes");
      const cost = formData.get("cost");

      const result = await completeTaskInstance(instance.id, {
        completedAt: typeof completedAt === "string" && completedAt ? completedAt : undefined,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
        cost: typeof cost === "string" && cost ? Number(cost) : null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Tarea completada.");
      setOpen(false);
      onCompleted();
    });
  }

  function handleSkip() {
    startTransition(async () => {
      const result = await skipTaskInstance(instance.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarea omitida.");
      setOpen(false);
      onSkipped();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{instance.definition.title}</DialogTitle>
          {instance.definition.description && (
            <DialogDescription>{instance.definition.description}</DialogDescription>
          )}
        </DialogHeader>

        <form action={handleComplete} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="completed_at">Fecha en que se hizo</Label>
            <Input
              id="completed_at"
              name="completed_at"
              type="date"
              defaultValue={todayInFamilyTimezone()}
              max={todayInFamilyTimezone()}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cost">Costo (opcional)</Label>
            <Input id="cost" name="cost" type="number" min="0" step="1" placeholder="0" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" name="notes" />
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button type="button" variant="outline" onClick={handleSkip} disabled={isPending}>
              Omitir
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Marcar hecha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
