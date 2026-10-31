"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { GNB_API_URL, beneficiosDeJsonGnb, totalPaginasGnb, type GnbBenefit } from "@/lib/promos/gnb";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importarTandaGnb } from "./actions";

// Mismo valor que TAMANO_TANDA_GNB (lib/promos/importar-gnb.ts, server-only).
const TAMANO_TANDA = 8;

const PAGINAS = [0, 1];

type Totales = { normalizadas: number; descartadas: number; sinCambios: number; errores: number };

/**
 * Importación del JSON de GNB: GNB no responde a los pedidos desde el
 * servidor, así que la persona abre la API en su navegador, copia el
 * JSON y lo pega acá. Se manda en tandas chicas (el servidor normaliza
 * con Claude solo lo nuevo o cambiado) y se muestra el avance.
 */
export function ImportarGnb() {
  const router = useRouter();
  const [paginas, setPaginas] = useState<string[]>(["", ""]);
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [totales, setTotales] = useState<Totales | null>(null);

  async function importar() {
    const beneficios: GnbBenefit[] = [];
    const vistos = new Set<string>();
    let totalPaginas: number | null = null;
    let pegadas = 0;
    for (const [i, texto] of paginas.entries()) {
      if (!texto.trim()) continue;
      let json: unknown;
      try {
        json = JSON.parse(texto);
      } catch {
        toast.error(`La página ${i + 1} no es un JSON válido. Copiá todo el texto de la página.`);
        return;
      }
      const lista = beneficiosDeJsonGnb(json);
      if (lista.length === 0) {
        toast.error(`No encontré promos en la página ${i + 1}.`);
        return;
      }
      pegadas++;
      totalPaginas = totalPaginas ?? totalPaginasGnb(json);
      for (const b of lista) {
        if (vistos.has(String(b.id))) continue;
        vistos.add(String(b.id));
        beneficios.push(b);
      }
    }
    if (beneficios.length === 0) {
      toast.error("Pegá el JSON de al menos una página.");
      return;
    }
    if (totalPaginas && pegadas < totalPaginas) {
      toast.warning(`GNB tiene ${totalPaginas} páginas y pegaste ${pegadas}: se importa igual lo que hay.`);
    }

    const acumulado: Totales = { normalizadas: 0, descartadas: 0, sinCambios: 0, errores: 0 };
    setTotales(null);
    setAvance({ hechos: 0, total: beneficios.length });
    for (let desde = 0; desde < beneficios.length; desde += TAMANO_TANDA) {
      const tanda = beneficios.slice(desde, desde + TAMANO_TANDA).map((b) => ({
        id: b.id,
        title: b.title ?? null,
        miniDescription: b.miniDescription ?? null,
        circleText: b.circleText ?? null,
        description: b.description ?? null,
        startDate: b.startDate ?? null,
        endDate: b.endDate ?? null,
      }));
      let result: Awaited<ReturnType<typeof importarTandaGnb>>;
      try {
        result = await importarTandaGnb(tanda);
      } catch {
        result = { error: "Se cortó la conexión." };
      }
      if (result.error || !result.resumen) {
        toast.error(`${result.error ?? "Error"} Se importaron ${desde} de ${beneficios.length}; podés volver a tocar Importar: lo hecho no se repite.`, {
          duration: 10_000,
        });
        setAvance(null);
        setTotales(acumulado);
        return;
      }
      const r = result.resumen;
      acumulado.normalizadas += r.normalizadas;
      acumulado.descartadas += r.descartadas + r.prefiltradas;
      acumulado.sinCambios += r.sinCambios;
      acumulado.errores += r.errores.length;
      setAvance({ hechos: Math.min(desde + TAMANO_TANDA, beneficios.length), total: beneficios.length });
    }
    setAvance(null);
    setTotales(acumulado);
    toast.success("Importación de GNB terminada.");
    router.refresh();
  }

  const importando = avance !== null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        GNB no deja que la app lea sus promos sola. Abrí cada página en el navegador, seleccioná todo el texto,
        copialo y pegalo acá.
      </p>
      {PAGINAS.map((pagina, i) => (
        <div key={pagina} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`gnb-${pagina}`}>Página {pagina + 1}</Label>
            <a
              href={`${GNB_API_URL}?pageSize=200&paginationKey=${pagina}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-sm text-primary"
            >
              Abrir <ExternalLink className="size-3.5" />
            </a>
          </div>
          <textarea
            id={`gnb-${pagina}`}
            className="min-h-24 rounded-md border bg-transparent px-3 py-2 font-mono text-xs"
            placeholder='{"data": [...'
            value={paginas[i]}
            disabled={importando}
            onChange={(e) => setPaginas(paginas.map((p, j) => (j === i ? e.target.value : p)))}
          />
        </div>
      ))}
      <Button disabled={importando} onClick={() => void importar()}>
        {importando ? `Importando… ${avance.hechos} de ${avance.total}` : "Importar"}
      </Button>
      {importando && (
        <p className="px-1 text-xs text-muted-foreground">
          Las promos nuevas se leen de a una con Claude: la primera vez puede tardar varios minutos. Dejá esta
          pantalla abierta.
        </p>
      )}
      {totales && (
        <p className="px-1 text-sm">
          {totales.normalizadas} guardadas o actualizadas, {totales.sinCambios} sin cambios, {totales.descartadas}{" "}
          descartadas
          {totales.errores > 0 ? `, ${totales.errores} con error (se reintentan en la próxima importación)` : ""}.
        </p>
      )}
    </div>
  );
}
