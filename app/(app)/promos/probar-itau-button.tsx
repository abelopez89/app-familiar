"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { PlugZap } from "lucide-react";
import { probarConexionItau } from "./actions";
import { Button } from "@/components/ui/button";

/** Botón de la prueba de conexión con Itaú: el resultado va en un toast. */
export function ProbarItauButton() {
  const [pending, startTransition] = useTransition();

  function probar() {
    startTransition(async () => {
      const result = await probarConexionItau();
      if (result.error) toast.error(result.error);
      else if (result.ok) toast.success(result.mensaje);
      else toast.error(result.mensaje, { duration: 10_000 });
    });
  }

  return (
    <Button variant="outline" size="sm" className="gap-2 self-start" disabled={pending} onClick={probar}>
      <PlugZap className="size-4" />
      {pending ? "Probando…" : "Probar conexión con Itaú"}
    </Button>
  );
}
