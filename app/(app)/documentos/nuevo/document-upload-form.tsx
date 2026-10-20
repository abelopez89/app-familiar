"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Camera, FileText, ImagePlus, X } from "lucide-react";
import { attachDocumentFile, createDocument } from "../actions";
import { uploadDocumentFileFromBrowser } from "@/lib/documents/browser-upload";
import { compressDocumentImage, validateDocumentFileSize } from "@/lib/documents/image";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import type { DocumentCategory, FamilyMember } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PendingFile = {
  key: string;
  originalName: string;
  /**
   * comprimiendo → lista (o error) mientras se arma el formulario; después
   * de guardar: subiendo → subida (o falló, con reintento).
   */
  status: "comprimiendo" | "lista" | "error" | "subiendo" | "subida" | "falló";
  preview?: string;
  compressed?: Blob;
  compressedName?: string;
  contentType?: string;
  /** Ruta de Storage y orden de página, asignados al guardar. */
  path?: string;
  sortOrder?: number;
  progress?: number;
};

export function DocumentUploadForm({
  categories,
  members,
}: {
  categories: DocumentCategory[];
  members: FamilyMember[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // Una vez creado el documento, el formulario solo sube páginas: no se
  // puede volver a guardar (crearía un segundo documento).
  const [documentId, setDocumentId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<PendingFile[]>([]);
  const [memberId, setMemberId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [docType, setDocType] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  function suggestTitle(nextDocType: string, nextMemberId: string) {
    if (titleTouched) return;
    const typeLabel = DOCUMENT_TYPES.find((t) => t.value === nextDocType)?.label;
    const memberName = members.find((m) => m.id === nextMemberId)?.display_name;
    const suggestion = [typeLabel, memberName].filter(Boolean).join(" ");
    if (suggestion) setTitle(suggestion);
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    // Copia antes del primer await: `FileList` es un objeto vivo y el
    // `onChange` vacía el input enseguida (`e.target.value = ""`), así que
    // leer `fileList[i]` después de comprimir el primero daba undefined y
    // las demás páginas quedaban en "Procesando…" para siempre.
    const selected = Array.from(fileList);

    const newEntries: PendingFile[] = selected.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      originalName: file.name,
      status: "comprimiendo",
    }));
    setFiles((prev) => [...prev, ...newEntries]);

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const key = newEntries[i].key;
      const sizeError = validateDocumentFileSize(file.size);
      if (sizeError && file.type === "application/pdf") {
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: "error" } : f)));
        toast.error(`${file.name}: ${sizeError}`);
        continue;
      }

      try {
        const result = await compressDocumentImage(file);
        const finalSizeError = validateDocumentFileSize(result.blob.size);
        if (finalSizeError) {
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: "error" } : f)));
          toast.error(`${file.name}: ${finalSizeError}`);
          continue;
        }
        const preview = result.contentType.startsWith("image/") ? URL.createObjectURL(result.blob) : undefined;
        setFiles((prev) =>
          prev.map((f) =>
            f.key === key
              ? {
                  ...f,
                  status: "lista",
                  compressed: result.blob,
                  compressedName: result.name,
                  contentType: result.contentType,
                  preview,
                }
              : f,
          ),
        );
      } catch {
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: "error" } : f)));
        toast.error(`No se pudo procesar ${file.name}.`);
      }
    }
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }

  function updateFile(key: string, patch: Partial<PendingFile>) {
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  /** Sube una página directo a Storage y la registra. */
  async function uploadOne(docId: string, f: PendingFile): Promise<boolean> {
    updateFile(f.key, { status: "subiendo", progress: 0 });
    const uploaded = await uploadDocumentFileFromBrowser(
      f.path!,
      f.compressed!,
      f.contentType ?? "",
      (progress) => updateFile(f.key, { progress }),
    );
    const attached = uploaded.error
      ? uploaded
      : await attachDocumentFile(docId, {
          path: f.path!,
          mimeType: f.contentType || null,
          sizeBytes: f.compressed!.size,
          sortOrder: f.sortOrder,
        });
    const ok = !attached.error;
    updateFile(f.key, { status: ok ? "subida" : "falló" });
    return ok;
  }

  function goToDocument(docId: string) {
    toast.success("Documento guardado.");
    router.push(`/documentos/${docId}`);
    // La acción no revalida: este refresh (detrás de la navegación)
    // descarta la caché para que /documentos muestre el documento nuevo.
    router.refresh();
  }

  async function uploadAll(docId: string, pending: PendingFile[]) {
    const results = await Promise.all(pending.map((f) => uploadOne(docId, f)));
    const failed = results.filter((ok) => !ok).length;
    if (failed === 0) {
      goToDocument(docId);
      return;
    }
    toast.error(
      failed === 1 ? "Una página no se pudo subir." : `${failed} páginas no se pudieron subir.`,
    );
  }

  // `onSubmit` y no `<form action>`: dentro de una acción de formulario
  // React no pinta los cambios de estado hasta que termina, y el progreso
  // de cada página no se vería.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (documentId) return;
    const ready = files.filter((f) => f.status === "lista" && f.compressed);
    if (ready.length === 0) {
      toast.error("Agregá al menos un archivo.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    for (const f of ready) formData.append("file_names", f.compressedName ?? f.originalName);

    // Guardar el documento es una sola fila (rápido); después cada página
    // sube en paralelo directo a Storage, con su progreso sobre la
    // miniatura, sin pasar por el servidor de la app.
    setSaving(true);
    const result = await createDocument({}, formData);
    setSaving(false);
    if (result.error || !result.id || !result.uploads) {
      toast.error(result.error ?? "No se pudo crear el documento.");
      return;
    }
    const docId = result.id;
    const pending = ready.map((f, i) => ({ ...f, path: result.uploads![i].path, sortOrder: i }));
    setDocumentId(docId);
    setFiles((prev) => prev.map((f) => pending.find((p) => p.key === f.key) ?? f));
    await uploadAll(docId, pending);
  }

  const uploadTargets = files.filter((f) => f.path);
  const uploading = uploadTargets.some((f) => f.status === "subiendo");
  const failedFiles = uploadTargets.filter((f) => f.status === "falló");
  const overallProgress =
    uploadTargets.length > 0
      ? uploadTargets.reduce((sum, f) => sum + (f.status === "subida" ? 1 : (f.progress ?? 0)), 0) /
        uploadTargets.length
      : 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Archivos</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2"
            disabled={!!documentId}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="size-4" />
            Tomar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2"
            disabled={!!documentId}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            Elegir archivo
          </Button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-muted-foreground">
          Podés agregar varias páginas (por ejemplo, frente y dorso de una cédula).
        </p>

        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f) => (
              <div key={f.key} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt={f.originalName} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <FileText className="size-8 text-muted-foreground" />
                  </div>
                )}
                {f.status === "comprimiendo" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-xs">
                    Procesando…
                  </div>
                )}
                {f.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 text-xs text-destructive">
                    Error
                  </div>
                )}
                {f.status === "subiendo" && (
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-background/85 px-2 py-1.5">
                    <span className="text-[11px] font-medium">{Math.round((f.progress ?? 0) * 100)}%</span>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: `${Math.round((f.progress ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {f.status === "subida" && (
                  <div className="absolute right-1 bottom-1 rounded-full bg-success p-1 text-success-foreground">
                    <Check className="size-3.5" />
                  </div>
                )}
                {f.status === "falló" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 text-xs text-destructive">
                    No se subió
                  </div>
                )}
                {!documentId && (
                  <button
                    type="button"
                    onClick={() => removeFile(f.key)}
                    className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
                    aria-label="Quitar"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>De quién es</Label>
        <Select
          value={memberId || "familia"}
          onValueChange={(v) => {
            const next = v === "familia" ? "" : v;
            setMemberId(next);
            suggestTitle(docType, next);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="familia">De la familia</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="member_id" value={memberId} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Tipo (opcional)</Label>
        <Select
          value={docType || "ninguno"}
          onValueChange={(v) => {
            const next = v === "ninguno" ? "" : v;
            setDocType(next);
            suggestTitle(next, memberId);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguno">Sin especificar</SelectItem>
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="doc_type" value={docType} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTouched(true);
          }}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Categoría (opcional)</Label>
        <Select value={categoryId || "ninguna"} onValueChange={(v) => setCategoryId(v === "ninguna" ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguna">Sin categoría</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="category_id" value={categoryId} />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="issued_at">Emitido (opcional)</Label>
          <Input id="issued_at" name="issued_at" type="date" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="expires_at">Vence (opcional)</Label>
          <Input id="expires_at" name="expires_at" type="date" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="expiry_lead_days">Avisar con anticipación (días)</Label>
        <Input id="expiry_lead_days" name="expiry_lead_days" type="number" min="0" defaultValue={60} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tags">Tags (separados por coma, opcional)</Label>
        <Input id="tags" name="tags" placeholder="Ej: importante, viaje" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" />
      </div>

      {!documentId ? (
        <Button type="submit" disabled={saving} className="h-12 text-base">
          {saving ? "Guardando…" : "Guardar documento"}
        </Button>
      ) : uploading ? (
        <Button type="button" disabled className="h-12 text-base">
          Subiendo… {Math.round(overallProgress * 100)}%
        </Button>
      ) : failedFiles.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            El documento quedó guardado
            {failedFiles.length < uploadTargets.length ? " con las páginas que sí subieron" : ", todavía sin páginas"}.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => goToDocument(documentId)}>
              Continuar sin {failedFiles.length === 1 ? "esa" : "esas"}
            </Button>
            <Button type="button" className="flex-1" onClick={() => void uploadAll(documentId, failedFiles)}>
              Reintentar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" disabled className="h-12 text-base">
          Listo
        </Button>
      )}
    </form>
  );
}
