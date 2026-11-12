"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quitarProductoReal } from "./actions";

export function QuitarProducto({ id, nombre }: { id: string; nombre: string }) {
  const [pending, startTransition] = useTransition();

  function quitar() {
    if (!window.confirm(`¿Quitar el producto de Real de "${nombre}"? La próxima vez el marcador te lo vuelve a preguntar.`)) {
      return;
    }
    startTransition(async () => {
      const resultado = await quitarProductoReal(id);
      if (resultado.error) toast.error(resultado.error);
    });
  }

  return (
    <Button variant="ghost" size="icon" onClick={quitar} disabled={pending} aria-label={`Quitar ${nombre}`}>
      <Trash2 className="size-4" />
    </Button>
  );
}
