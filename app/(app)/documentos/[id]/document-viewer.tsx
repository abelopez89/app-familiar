"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Pin, Share2 } from "lucide-react";
import { toast } from "sonner";
import { toggleDocumentPinned } from "../actions";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/constants";
import type { DocumentCategory, DocumentFile, FamilyMember } from "@/lib/supabase/types";
import type { DocumentWithFiles } from "@/lib/documents/queries";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EditDocumentDialog } from "./edit-document-dialog";
import { DeleteDocumentButton } from "./delete-document-button";
import { ManageFiles } from "./manage-files";

export function DocumentViewer({
  document,
  fileUrls,
  categories,
  members,
}: {
  document: DocumentWithFiles;
  fileUrls: { file: DocumentFile; url: string | null }[];
  categories: DocumentCategory[];
  members: FamilyMember[];
}) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const category = categories.find((c) => c.id === document.category_id);
  const member = members.find((m) => m.id === document.member_id);
  const current = fileUrls[index];

  function handleTogglePin() {
    startTransition(async () => {
      const result = await toggleDocumentPinned(document.id, !document.is_pinned);
      if (result.error) toast.error(result.error);
    });
  }

  async function handleShare() {
    if (!current?.url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url: current.url });
      } catch {
        // el usuario canceló el share sheet — no es un error a mostrar
      }
    } else {
      toast.error("Este navegador no soporta compartir directamente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-xl font-semibold">{document.title}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleTogglePin}
          disabled={isPending}
          aria-label={document.is_pinned ? "Quitar de fijados" : "Fijar"}
        >
          <Pin className={document.is_pinned ? "size-5 fill-primary text-primary" : "size-5"} />
        </Button>
      </div>

      {fileUrls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <FileText className="size-10" />
            <p className="text-sm">Este documento no tiene archivos.</p>
          </CardContent>
        </Card>
      ) : current?.file.mime_type === "application/pdf" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <FileText className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Documento PDF</p>
            {current.url && (
              <Button asChild>
                <a href={current.url} target="_blank" rel="noreferrer">
                  Abrir PDF
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="relative overflow-hidden rounded-lg border bg-black">
          {current?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={document.title}
              onClick={() => setZoomed((z) => !z)}
              className={`mx-auto max-h-[70vh] w-full cursor-zoom-in object-contain transition-transform ${
                zoomed ? "scale-150 cursor-zoom-out" : ""
              }`}
            />
          )}
          {fileUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/80 p-2 disabled:opacity-30"
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(fileUrls.length - 1, i + 1))}
                disabled={index === fileUrls.length - 1}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/80 p-2 disabled:opacity-30"
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-5" />
              </button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2 py-0.5 text-xs">
                {index + 1} / {fileUrls.length}
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {current?.url && (
          <Button asChild variant="outline" className="flex-1 gap-2">
            <a href={current.url} download>
              <Download className="size-4" />
              Descargar
            </a>
          </Button>
        )}
        <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
          <Share2 className="size-4" />
          Compartir
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            {document.doc_type && (
              <Badge variant="outline">{DOCUMENT_TYPE_LABELS[document.doc_type] ?? document.doc_type}</Badge>
            )}
            {category && <Badge variant="outline">{category.name}</Badge>}
            {(document.tags ?? []).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          <p>{member ? member.display_name : "De la familia"}</p>
          {document.issued_at && <p className="text-muted-foreground">Emitido: {formatDate(document.issued_at)}</p>}
          {document.expires_at && <p className="text-muted-foreground">Vence: {formatDate(document.expires_at)}</p>}
          {document.notes && <p className="text-muted-foreground">{document.notes}</p>}

          <div className="mt-2 flex gap-2">
            <EditDocumentDialog document={document} categories={categories} members={members} />
            <DeleteDocumentButton id={document.id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          <span className="text-sm font-medium">Páginas</span>
          <ManageFiles documentId={document.id} fileUrls={fileUrls} />
        </CardContent>
      </Card>
    </div>
  );
}
