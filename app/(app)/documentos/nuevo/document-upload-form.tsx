"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, FileText, ImagePlus, X } from "lucide-react";
import { createDocument } from "../actions";
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
  status: "comprimiendo" | "lista" | "error";
  preview?: string;
  compressed?: Blob;
  compressedName?: string;
};

export function DocumentUploadForm({
  categories,
  members,
}: {
  categories: DocumentCategory[];
  members: FamilyMember[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

    const newEntries: PendingFile[] = Array.from(fileList).map((file) => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      originalName: file.name,
      status: "comprimiendo",
    }));
    setFiles((prev) => [...prev, ...newEntries]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
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
              ? { ...f, status: "lista", compressed: result.blob, compressedName: result.name, preview }
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

  function handleSubmit(formData: FormData) {
    const ready = files.filter((f) => f.status === "lista" && f.compressed);
    if (ready.length === 0) {
      toast.error("Agregá al menos un archivo.");
      return;
    }
    for (const f of ready) {
      formData.append("files", f.compressed as Blob, f.compressedName ?? f.originalName);
    }

    startTransition(async () => {
      const result = await createDocument({}, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Documento guardado.");
      router.push(`/documentos/${result.id}`);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Archivos</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="size-4" />
            Tomar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2"
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
                <button
                  type="button"
                  onClick={() => removeFile(f.key)}
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
                  aria-label="Quitar"
                >
                  <X className="size-3.5" />
                </button>
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

      <Button type="submit" disabled={isPending} className="h-12 text-base">
        {isPending ? "Guardando…" : "Guardar documento"}
      </Button>
    </form>
  );
}
