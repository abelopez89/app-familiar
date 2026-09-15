"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFuelLog, updateFuelLog } from "./actions";
import type { FuelLog } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FuelLogEditDialog({ log, trigger }: { log: FuelLog; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isFullTank, setIsFullTank] = useState(log.is_full_tank);
  const [resetsCalculation, setResetsCalculation] = useState(log.resets_calculation);
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSubmit(formData: FormData) {
    formData.set("is_full_tank", isFullTank ? "on" : "");
    formData.set("resets_calculation", resetsCalculation ? "on" : "");
    startTransition(async () => {
      const result = await updateFuelLog(log.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Carga actualizada.");
      setOpen(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFuelLog(log.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Carga eliminada.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar carga</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="odometer">Kilometraje</Label>
              <Input id="odometer" name="odometer" type="number" min="0" step="0.1" defaultValue={log.odometer} required />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="liters">Litros</Label>
              <Input id="liters" name="liters" type="number" min="0" step="0.01" defaultValue={log.liters} required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="total_amount">Monto (Gs.)</Label>
            <Input
              id="total_amount"
              name="total_amount"
              type="number"
              min="0"
              step="1"
              defaultValue={log.total_amount ?? ""}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_full_tank">Tanque lleno</Label>
            <Switch id="is_full_tank" checked={isFullTank} onCheckedChange={setIsFullTank} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="resets_calculation">Me olvidé de registrar una carga anterior</Label>
            <Switch id="resets_calculation" checked={resetsCalculation} onCheckedChange={setResetsCalculation} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="station">Estación</Label>
            <Input id="station" name="station" defaultValue={log.station ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fuel_grade">Tipo de nafta</Label>
            <Input id="fuel_grade" name="fuel_grade" defaultValue={log.fuel_grade ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" defaultValue={log.notes ?? ""} />
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">¿Eliminar?</span>
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
                  Sí
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                  No
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={() => setConfirmingDelete(true)}
                disabled={isPending}
              >
                Eliminar
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
