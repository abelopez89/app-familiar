"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { actualizarPromosAhora } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REFRESCO_MS = 15_000;

/**
 * Dispara la ingesta desde la app y, mientras la línea de estado dice que
 * está en curso, refresca la pantalla cada 15 s para que se vea cuándo
 * termina sin tener que recargar a mano.
 */
export function ActualizarButton({ enCurso }: { enCurso: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enCurso) return;
    const id = setInterval(() => router.refresh(), REFRESCO_MS);
    return () => clearInterval(id);
  }, [enCurso, router]);

  function actualizar() {
    startTransition(async () => {
      const result = await actualizarPromosAhora();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Actualizando las promos. Tarda unos minutos.");
      // La fila de la ingesta se crea apenas arranca: con este refresco la
      // línea pasa a "actualizando…" y empieza el refresco periódico.
      setTimeout(() => router.refresh(), 3_000);
    });
  }

  const ocupado = pending || enCurso;
  return (
    <Button variant="outline" size="sm" className="gap-2 self-start" disabled={ocupado} onClick={actualizar}>
      <RefreshCw className={cn("size-4", ocupado && "animate-spin")} />
      {enCurso ? "Actualizando…" : "Actualizar ahora"}
    </Button>
  );
}
