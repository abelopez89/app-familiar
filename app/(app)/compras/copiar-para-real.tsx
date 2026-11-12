"use client";

import { toast } from "sonner";
import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ListaParaReal, ProductoParaReal } from "@/lib/shopping/real";

/**
 * Copia los productos que faltan de la lista para pegarlos en el marcador
 * "Llenar carrito Real" (dentro de la página de Real). La dirección de
 * vuelta sale de esta misma app (`location.origin`), así un deploy de
 * preview vuelve al preview y no a producción.
 */
export function CopiarParaReal({ lista, productos }: { lista: string; productos: ProductoParaReal[] }) {
  async function copiar() {
    const datos: ListaParaReal = {
      app: "app-familiar",
      v: 1,
      lista,
      volver: `${window.location.origin}/compras/real/guardar`,
      productos,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(datos));
      toast.success("Lista copiada. Abrí Real y tocá el marcador \"Llenar carrito Real\".");
    } catch {
      toast.error("No se pudo copiar. Probá de nuevo.");
    }
  }

  return (
    <Button variant="outline" onClick={copiar} disabled={productos.length === 0}>
      <ClipboardCopy className="size-4" />
      Copiar para Real
    </Button>
  );
}
