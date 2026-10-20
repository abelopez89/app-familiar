import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getDocumentWithFiles, listDocumentCategories } from "@/lib/documents/queries";
import { getSignedDocumentUrls } from "@/lib/documents/storage";
import { createClient } from "@/lib/supabase/server";
import { DocumentViewer } from "./document-viewer";

export default async function DocumentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();
  // Las URLs firmadas se piden en una sola llamada y encadenadas a la
  // lectura del documento, en paralelo con categorías y miembros: antes
  // eran una tanda de consultas, después una URL por página.
  const [loaded, categories, membersRes] = await Promise.all([
    getDocumentWithFiles(id).then(async (doc) => {
      if (!doc) return null;
      const urls = await getSignedDocumentUrls(doc.files.map((f) => f.storage_path));
      return { document: doc, fileUrls: doc.files.map((file, i) => ({ file, url: urls[i] })) };
    }),
    listDocumentCategories(),
    supabase.from("family_members").select("*").eq("is_active", true).order("created_at", { ascending: true }),
  ]);

  if (!loaded) notFound();
  const { document, fileUrls } = loaded;

  return (
    <DocumentViewer
      document={document}
      fileUrls={fileUrls}
      categories={categories}
      members={membersRes.data ?? []}
    />
  );
}
