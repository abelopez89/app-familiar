"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteSettlement } from "../../actions";
import { Button } from "@/components/ui/button";

export function DeleteSettlementButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      aria-label="Eliminar pago"
      onClick={() => {
        if (!window.confirm("¿Eliminar este pago? Los balances vuelven a como estaban antes de registrarlo.")) return;
        startTransition(async () => {
          const result = await deleteSettlement(id);
          if (result.error) toast.error(result.error);
          else toast.success("Pago eliminado.");
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
