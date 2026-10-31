"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desactivarPromo, reactivarPromo } from "./actions";

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

/** Vuelve a mostrar una promo desactivada. */
export function ReactivarButton({ promoId }: { promoId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 self-end px-2 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reactivarPromo(promoId);
          if (result.error) toast.error(result.error);
          else toast.success("Promo reactivada.");
        })
      }
    >
      <Eye className="size-3.5" />
      {pending ? "Reactivando…" : "Reactivar"}
    </Button>
  );
}
