"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Bookmark, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * El link del marcador "Llenar carrito Real" para arrastrar a la barra de
 * marcadores. React no deja poner un `javascript:` en `href` (lo bloquea
 * como medida de seguridad), así que se asigna a mano después de montar.
 * "Copiar el código" es para crear el marcador a mano si arrastrar no anda.
 */
export function InstalarMarcador({ href }: { href: string }) {
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    link.current?.setAttribute("href", href);
  }, [href]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(href);
      toast.success("Código copiado. Pegalo como dirección (URL) de un marcador nuevo.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        ref={link}
        onClick={(e) => {
          e.preventDefault();
          toast.info("Arrastralo a la barra de marcadores; se usa desde la página de Real.");
        }}
        className="inline-flex items-center gap-2 rounded-full bg-mod-compras px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        <Bookmark className="size-4" />
        Llenar carrito Real
      </a>
      <Button variant="outline" onClick={copiar}>
        <ClipboardCopy className="size-4" />
        Copiar el código
      </Button>
    </div>
  );
}
