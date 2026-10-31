"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type { PromoFiltrada } from "@/lib/promos/filtrado";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditorPromo } from "../../cargar/editor-promo";
import { guardarEdicionPromo } from "../../actions";

export function EditarPromo({
  id,
  promo: inicial,
  archivo,
  activa,
}: {
  id: string;
  promo: PromoFiltrada;
  archivo: string | null;
  activa: boolean;
}) {
  const router = useRouter();
  const [promo, setPromo] = useState(inicial);
  // El último valor, leído al guardar: el blur de abajo confirma el campo
  // enfocado en el mismo instante y el estado todavía no se volvió a pintar.
  const ultima = useRef(inicial);
  const [pending, startTransition] = useTransition();

  function cambiar(p: PromoFiltrada) {
    ultima.current = p;
    setPromo(p);
  }

  function guardar() {
    // Los campos confirman en onBlur: sacarle el foco al último antes de leer el estado.
    (document.activeElement as HTMLElement | null)?.blur();
    startTransition(async () => {
      const result = await guardarEdicionPromo({ id, promo: ultima.current });
      if (result.error) {
        toast.error(result.error, { duration: 8_000 });
        return;
      }
      toast.success("Promo guardada.");
      router.back();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!activa && (
        <p className="px-1 text-sm text-muted-foreground">
          Esta promo está desactivada. Guardar la corrige pero no la reactiva.
        </p>
      )}
      {archivo && (
        <Button asChild variant="outline" className="gap-2 self-start">
          <a href={archivo} target="_blank" rel="noreferrer">
            <Download className="size-4" />
            Descargar el archivo original
          </a>
        </Button>
      )}
      <Card className="gap-0 py-0">
        <CardContent className="p-4">
          <EditorPromo promo={promo} onChange={cambiar} reemplazos={[]} reemplaza={[]} onReemplazaChange={() => {}} />
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={pending} onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={pending} onClick={guardar}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
