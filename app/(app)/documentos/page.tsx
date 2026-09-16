import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listDocumentCategories, listDocumentsWithFiles } from "@/lib/documents/queries";
import { getSignedDocumentUrl } from "@/lib/documents/storage";
import { createClient } from "@/lib/supabase/server";
import { DocumentsBrowser } from "./documents-browser";

export default async function DocumentosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const [documents, categories, membersRes] = await Promise.all([
    listDocumentsWithFiles(),
    listDocumentCategories(),
    supabase.from("family_members").select("*").eq("is_active", true).order("created_at", { ascending: true }),
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
  const thumbnails = Object.fromEntries(thumbnailEntries.filter((e): e is [string, string] => e !== null));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Documentos</h1>
      <DocumentsBrowser
        documents={documents}
        categories={categories}
        members={membersRes.data ?? []}
        thumbnails={thumbnails}
      />
    </div>
  );
}
