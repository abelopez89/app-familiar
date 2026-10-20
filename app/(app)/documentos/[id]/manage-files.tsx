"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, ImagePlus, RotateCw, X } from "lucide-react";
import { attachDocumentFile, prepareDocumentFiles, removeDocumentFile } from "../actions";
import { compressDocumentImage, validateDocumentFileSize } from "@/lib/documents/image";
import { uploadDocumentFileFromBrowser } from "@/lib/documents/browser-upload";
import type { DocumentFile } from "@/lib/supabase/types";

/** Una página que se está agregando (todavía no está en `fileUrls`). */
type Upload = {
  path: string;
  sortOrder: number;
  blob: Blob;
  contentType: string;
  preview?: string;
  status: "subiendo" | "subida" | "falló";
  progress: number;
};

export function ManageFiles({
  documentId,
  fileUrls,
}: {
  documentId: string;
  fileUrls: { file: DocumentFile; url: string | null }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processing, setProcessing] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Una página subida sigue mostrándose con su miniatura local hasta que
  // el refresh trae la real (misma ruta de Storage), así no parpadea.
  const savedPaths = new Set(fileUrls.map(({ file }) => file.storage_path));
  const visibleUploads = uploads.filter((u) => !savedPaths.has(u.path));

  function updateUpload(path: string, patch: Partial<Upload>) {
    setUploads((prev) => prev.map((u) => (u.path === path ? { ...u, ...patch } : u)));
  }

  /** Sube una página directo a Storage y la registra (mismo camino que /documentos/nuevo). */
  async function uploadOne(u: Upload): Promise<boolean> {
    updateUpload(u.path, { status: "subiendo", progress: 0 });
    const uploaded = await uploadDocumentFileFromBrowser(u.path, u.blob, u.contentType, (progress) =>
      updateUpload(u.path, { progress }),
    );
    const attached = uploaded.error
      ? uploaded
      : await attachDocumentFile(documentId, {
          path: u.path,
          mimeType: u.contentType || null,
          sizeBytes: u.blob.size,
          sortOrder: u.sortOrder,
        });
    const ok = !attached.error;
    updateUpload(u.path, { status: ok ? "subida" : "falló" });
    return ok;
  }

  async function uploadAll(batch: Upload[]) {
    const results = await Promise.all(batch.map(uploadOne));
    const added = results.filter(Boolean).length;
    const failed = results.length - added;
    if (added > 0) {
      toast.success(added === 1 ? "Página agregada." : `${added} páginas agregadas.`);
      // Trae las páginas nuevas con sus URLs firmadas al visor.
      router.refresh();
    }
    if (failed > 0) {
      toast.error(
        failed === 1
          ? "Una página no se pudo subir. Tocala para reintentar."
          : `${failed} páginas no se pudieron subir. Tocalas para reintentar.`,
      );
    }
  }

  async function handleAdd(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    // Copia antes del primer await: el onChange vacía el input enseguida y
    // FileList es un objeto vivo.
    const selected = Array.from(fileList);

    setProcessing(true);
    const compressed: { blob: Blob; name: string; contentType: string }[] = [];
    for (const file of selected) {
      try {
        const result = await compressDocumentImage(file);
        const sizeError = validateDocumentFileSize(result.blob.size);
        if (sizeError) {
          toast.error(`${file.name}: ${sizeError}`);
          continue;
        }
        compressed.push({ blob: result.blob, name: result.name, contentType: result.contentType });
      } catch {
        toast.error(`No se pudo procesar ${file.name}.`);
      }
    }

    if (compressed.length === 0) {
      setProcessing(false);
      return;
    }

    const prepared = await prepareDocumentFiles(
      documentId,
      compressed.map((c) => c.name),
    );
    setProcessing(false);
    if (prepared.error || !prepared.uploads) {
      toast.error(prepared.error ?? "No se pudieron agregar las páginas.");
      return;
    }

    const batch: Upload[] = compressed.map((c, i) => ({
      path: prepared.uploads![i].path,
      sortOrder: prepared.uploads![i].sortOrder,
      blob: c.blob,
      contentType: c.contentType,
      preview: c.contentType.startsWith("image/") ? URL.createObjectURL(c.blob) : undefined,
      status: "subiendo",
      progress: 0,
    }));
    setUploads((prev) => [...prev, ...batch]);
    await uploadAll(batch);
  }

  function handleRemove(fileId: string) {
    startTransition(async () => {
      const result = await removeDocumentFile(fileId, documentId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {fileUrls.map(({ file, url }) => (
          <div key={file.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            {file.mime_type?.startsWith("image/") && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <FileText className="size-6 text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              onClick={() => handleRemove(file.id)}
              disabled={isPending}
              className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
              aria-label="Quitar página"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {visibleUploads.map((u) => (
          <div key={u.path} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            {u.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.preview} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <FileText className="size-6 text-muted-foreground" />
              </div>
            )}
            {u.status === "subiendo" && (
              <div className="absolute inset-x-0 bottom-0 bg-background/85 px-1.5 py-1">
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${Math.round(u.progress * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {u.status === "falló" && (
              <>
                <button
                  type="button"
                  onClick={() => void uploadAll([u])}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/10 text-[11px] text-destructive"
                  aria-label="Reintentar la subida"
                >
                  <RotateCw className="size-4" />
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => setUploads((prev) => prev.filter((x) => x.path !== u.path))}
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
                  aria-label="Descartar página"
                >
                  <X className="size-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending || processing}
          className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-muted-foreground"
          aria-label="Agregar páginas"
        >
          {processing ? <span className="text-[11px]">Procesando…</span> : <ImagePlus className="size-6" />}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
