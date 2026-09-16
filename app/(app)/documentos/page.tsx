import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { listDocumentCategories, listDocumentsWithFiles } from "@/lib/documents/queries";
import { listActiveMembers } from "@/lib/members";
import { getSignedDocumentUrl } from "@/lib/documents/storage";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { DocumentsBrowser } from "./documents-browser";

export default async function DocumentosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [documents, categories, members] = await Promise.all([
    listDocumentsWithFiles(),
    listDocumentCategories(),
    listActiveMembers(),
  ]);

  // Miniatura solo para los fijados (son pocos, por diseño) — el resto de
  // la lista muestra un ícono genérico para no pagar una signed URL por
  // documento en cada carga de /documentos.
  const pinned = documents.filter((d) => d.is_pinned);
  const thumbnailEntries = await Promise.all(
    pinned.map(async (doc) => {
      const firstImage = doc.files.find((f) => f.mime_type?.startsWith("image/"));
      if (!firstImage) return null;
      const url = await getSignedDocumentUrl(firstImage.storage_path);
      return url ? ([doc.id, url] as const) : null;
    }),
  );
  const thumbnails = Object.fromEntries(
    thumbnailEntries.filter((e): e is [string, string] => e !== null),
  );

  const { fg, bg } = MODULES_BY_KEY.documentos;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Documentos"
        icon={FileText}
        iconFg={fg}
        iconBg={bg}
        actions={
          <Button asChild size="icon" className="size-10">
            <Link href="/documentos/nuevo" aria-label="Nuevo documento">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />
      <DocumentsBrowser
        documents={documents}
        categories={categories}
        members={members}
        thumbnails={thumbnails}
      />
    </div>
  );
}
