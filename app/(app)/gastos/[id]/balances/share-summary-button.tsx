"use client";

import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Resumen en texto plano (totales, balances y transferencias) para mandar
 * por WhatsApp con la Web Share API. Si el navegador no la soporta, se
 * copia al portapapeles.
 */
export function ShareSummaryButton({ text, title }: { text: string; title: string }) {
  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch {
        // La persona canceló el diálogo de compartir: no es un error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumen copiado. Pegalo en WhatsApp.");
    } catch {
      toast.error("No se pudo copiar el resumen.");
    }
  }

  return (
    <Button variant="outline" className="h-12 gap-2" onClick={handleShare}>
      <Share2 className="size-4" />
      Compartir resumen
    </Button>
  );
}
