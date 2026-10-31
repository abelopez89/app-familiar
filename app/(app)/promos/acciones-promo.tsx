import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesactivarButton, ReactivarButton } from "./desactivar-button";

/**
 * Acciones al pie de cada promo en `/promos` y `/promos/todas`: corregir
 * lo que se leyó mal, bajar el PDF o la captura original (solo las
 * cargadas a mano guardan archivo) y desactivar o reactivar.
 */
export function AccionesPromo({
  promo,
}: {
  promo: { id: string; titulo: string; activa: boolean; archivo_path: string | null };
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {promo.archivo_path && (
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground">
          <a href={`/promos/${promo.id}/archivo`} target="_blank" rel="noreferrer">
            <Download className="size-3.5" />
            Archivo
          </a>
        </Button>
      )}
      <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground">
        <Link href={`/promos/${promo.id}/editar`}>
          <Pencil className="size-3.5" />
          Editar
        </Link>
      </Button>
      {promo.activa ? (
        <DesactivarButton promoId={promo.id} titulo={promo.titulo} />
      ) : (
        <ReactivarButton promoId={promo.id} />
      )}
    </div>
  );
}
