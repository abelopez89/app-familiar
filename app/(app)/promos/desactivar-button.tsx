"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desactivarPromo } from "./actions";

/** Saca de la vista una promo mal leída (no la borra). */
export function DesactivarButton({ promoId, titulo }: { promoId: string; titulo: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 self-end px-2 text-xs text-muted-foreground"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`¿Desactivar "${titulo}"? Deja de mostrarse para todos. Usalo si se leyó mal.`)) return;
        startTransition(async () => {
          const result = await desactivarPromo(promoId);
          if (result.error) toast.error(result.error);
          else toast.success("Promo desactivada.");
        });
      }}
    >
      <EyeOff className="size-3.5" />
      {pending ? "Desactivando…" : "Desactivar"}
    </Button>
  );
}
