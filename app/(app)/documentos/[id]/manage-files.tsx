"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { FileText, ImagePlus, X } from "lucide-react";
import { addDocumentFiles, removeDocumentFile } from "../actions";
import { compressDocumentImage, validateDocumentFileSize } from "@/lib/documents/image";
import type { DocumentFile } from "@/lib/supabase/types";

export function ManageFiles({
  documentId,
  fileUrls,
}: {
  documentId: string;
  fileUrls: { file: DocumentFile; url: string | null }[];
}) {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const compressed: File[] = [];
    for (const file of Array.from(fileList)) {
      const result = await compressDocumentImage(file);
      const sizeError = validateDocumentFileSize(result.blob.size);
      if (sizeError) {
        toast.error(`${file.name}: ${sizeError}`);
        continue;
      }
      compressed.push(new File([result.blob], result.name, { type: result.contentType }));
    }

    if (compressed.length === 0) return;

    startTransition(async () => {
      const result = await addDocumentFiles(documentId, compressed);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Página agregada.");
    });
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-muted-foreground"
        >
          <ImagePlus className="size-6" />
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
