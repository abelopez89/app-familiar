"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createSettlement } from "../../actions";
import { PAYMENT_METHODS } from "@/lib/expenses/constants";
import { formatGuaranies } from "@/lib/format";
import type { ExpensePaymentMethod } from "@/lib/supabase/types";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Registrar un pago entre dos participantes. Desde una línea del clearing
 * viene precargado (quién, a quién, cuánto); el importe se puede cambiar
 * para un pago parcial. Al guardar, balances y clearing se recalculan
 * solos: el pago es una fila más de `settlements`.
 */
export function RecordPaymentDialog({
  groupId,
  participants,
  today,
  defaults,
  variant = "button",
}: {
  groupId: string;
  participants: { id: string; display_name: string }[];
  today: string;
  defaults?: { from: string; to: string; amount: number };
  variant?: "button" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(defaults?.from ?? "");
  const [to, setTo] = useState(defaults?.to ?? "");
  const [amount, setAmount] = useState(defaults ? String(defaults.amount) : "");
  const [method, setMethod] = useState<ExpensePaymentMethod>("transferencia");

  function handleSubmit(formData: FormData) {
    formData.set("group_id", groupId);
    formData.set("from_participant", from);
    formData.set("to_participant", to);
    formData.set("amount_pyg", amount);
    formData.set("payment_method", method);
    startTransition(async () => {
      const result = await createSettlement(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pago registrado.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "button" ? (
          <Button variant="outline" size="sm" className="w-full">
            Registrar pago
          </Button>
        ) : (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs">
            Registrar otro pago
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Paga</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí quién paga" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Recibe</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí quién recibe" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount_pyg">Importe (Gs)</Label>
            <Input
              id="amount_pyg"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="tabular-nums"
            />
            {amount && <p className="text-xs text-muted-foreground">{formatGuaranies(Number(amount))}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Cómo</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as ExpensePaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_METHODS) as ExpensePaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHODS[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settled_on">Fecha</Label>
            <Input id="settled_on" name="settled_on" type="date" defaultValue={today} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" name="notes" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
