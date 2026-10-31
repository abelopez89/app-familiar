"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { compressDocumentImage, validateDocumentFileSize } from "@/lib/documents/image";
import { uploadDocumentFileFromBrowser } from "@/lib/documents/browser-upload";
import type { PromoFiltrada } from "@/lib/promos/filtrado";
import { RUBROS } from "@/lib/promos/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { guardarPromosManuales, leerPromoManual, prepararSubidaPromo, type Reemplazo } from "./actions";
import { EditorPromo } from "./editor-promo";

type Item = { incluir: boolean; promo: PromoFiltrada; reemplazos: Reemplazo[]; reemplaza: string[] };

type Paso =
  | { tipo: "elegir" }
  | { tipo: "procesando"; mensaje: string }
  | { tipo: "revisar"; path: string; items: Item[]; descartadas: Array<{ titulo: string; motivo: string }> };

const TIPOS_ACEPTADOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Carga manual de una promo de Sudameris o BASA: PDF de bases y
 * condiciones o captura. El archivo se sube directo a Storage (como en
 * Documentos: comprimido si es foto), Claude lo lee y propone las promos,
 * y la persona las revisa y corrige antes de guardar.
 */
export function CargarPromo() {
  const router = useRouter();
  const [banco, setBanco] = useState<string>("");
  const [paso, setPaso] = useState<Paso>({ tipo: "elegir" });
  const [guardando, setGuardando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function leer(file: File) {
    if (!banco) {
      toast.error("Elegí primero el banco.");
      return;
    }
    setPaso({ tipo: "procesando", mensaje: "Preparando el archivo…" });
    const comprimido = await compressDocumentImage(file);
    if (!TIPOS_ACEPTADOS.includes(comprimido.contentType)) {
      setPaso({ tipo: "elegir" });
      toast.error("Ese formato no se puede leer. Subí un PDF o una captura en JPG o PNG.");
      return;
    }
    const errorTamano = validateDocumentFileSize(comprimido.blob.size);
    if (errorTamano) {
      setPaso({ tipo: "elegir" });
      toast.error(errorTamano);
      return;
    }

    const { path, error } = await prepararSubidaPromo(comprimido.name);
    if (!path) {
      setPaso({ tipo: "elegir" });
      toast.error(error ?? "No se pudo preparar la subida.");
      return;
    }

    const subida = await uploadDocumentFileFromBrowser(path, comprimido.blob, comprimido.contentType, (f) =>
      setPaso({ tipo: "procesando", mensaje: `Subiendo… ${Math.round(f * 100)}%` }),
    );
    if (subida.error) {
      setPaso({ tipo: "elegir" });
      toast.error(subida.error);
      return;
    }

    setPaso({ tipo: "procesando", mensaje: "Leyendo la promo… puede tardar un minuto." });
    const result = await leerPromoManual({ banco, path, mediaType: comprimido.contentType });
    if ("error" in result) {
      setPaso({ tipo: "elegir" });
      toast.error(result.error);
      return;
    }
    if (result.promos.length === 0) {
      setPaso({ tipo: "elegir" });
      toast.error(
        result.descartadas.length > 0
          ? `No hay nada para guardar: ${result.descartadas.map((d) => `${d.titulo} (${d.motivo})`).join("; ")}.`
          : "No se encontró ninguna promo en el archivo.",
        { duration: 10_000 },
      );
      return;
    }
    setPaso({
      tipo: "revisar",
      path,
      descartadas: result.descartadas,
      items: result.promos.map((p) => ({
        incluir: true,
        promo: p.promo,
        reemplazos: p.reemplazos,
        // Por defecto reemplaza, salvo que la que ya está parezca más nueva.
        reemplaza: p.reemplazos.filter((r) => !r.esMasNueva).map((r) => r.id),
      })),
    });
  }

  async function guardar() {
    if (paso.tipo !== "revisar") return;
    const items = paso.items.filter((i) => i.incluir);
    if (items.length === 0) {
      toast.error("Marcá al menos una promo para guardar.");
      return;
    }
    setGuardando(true);
    const result = await guardarPromosManuales({
      banco,
      path: paso.path,
      items: items.map((i) => ({ promo: i.promo, reemplaza: i.reemplaza })),
    });
    setGuardando(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.guardadas === 1 ? "Promo guardada." : `${result.guardadas} promos guardadas.`);
    router.push("/promos");
  }

  function actualizarItem(indice: number, cambios: Partial<Item>) {
    if (paso.tipo !== "revisar") return;
    setPaso({ ...paso, items: paso.items.map((it, i) => (i === indice ? { ...it, ...cambios } : it)) });
  }

  if (paso.tipo === "revisar") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Revisá lo que se leyó del archivo y corregí lo que haga falta antes de guardar.
        </p>
        {paso.items.map((item, i) => (
          <Card key={i} className="gap-0 py-0">
            <CardContent className="flex flex-col gap-3 p-4">
              <label className="tap-target flex items-center gap-2">
                <Checkbox checked={item.incluir} onCheckedChange={(v) => actualizarItem(i, { incluir: v === true })} />
                <span className="font-semibold">
                  {RUBROS[item.promo.rubro].emoji} {item.promo.titulo}
                </span>
              </label>
              {item.incluir && (
                <EditorPromo
                  promo={item.promo}
                  onChange={(promo) => actualizarItem(i, { promo })}
                  reemplazos={item.reemplazos}
                  reemplaza={item.reemplaza}
                  onReemplazaChange={(reemplaza) => actualizarItem(i, { reemplaza })}
                />
              )}
            </CardContent>
          </Card>
        ))}
        {paso.descartadas.length > 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            Se descartaron: {paso.descartadas.map((d) => `${d.titulo} (${d.motivo})`).join("; ")}.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={guardando} onClick={() => setPaso({ tipo: "elegir" })}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    );
  }

  const procesando = paso.tipo === "procesando";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Banco</Label>
        <Select value={banco} onValueChange={setBanco} disabled={procesando}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Elegí" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sudameris">Sudameris</SelectItem>
            <SelectItem value="basa">BASA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void leer(file);
        }}
      />
      <Button className="gap-2" disabled={procesando || !banco} onClick={() => inputRef.current?.click()}>
        <FileUp className="size-4" />
        {procesando ? paso.mensaje : "Elegir PDF o captura"}
      </Button>
      <p className="px-1 text-xs text-muted-foreground">
        Las bases y condiciones en PDF, o una captura de la promo. Un PDF puede traer varias promos: se
        guardan solo las de supermercado, farmacia, combustible y electrodomésticos con descuento.
      </p>
    </div>
  );
}
