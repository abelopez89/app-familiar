import { notFound, redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getDocumentWithFiles, listDocumentCategories } from "@/lib/documents/queries";
import { getSignedDocumentUrl } from "@/lib/documents/storage";
import { createClient } from "@/lib/supabase/server";
import { DocumentViewer } from "./document-viewer";

export default async function DocumentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();
  const [document, categories, membersRes] = await Promise.all([
    getDocumentWithFiles(id),
    listDocumentCategories(),
    supabase.from("family_members").select("*").eq("is_active", true).order("created_at", { ascending: true }),
  ]);

  if (!document) notFound();

  const fileUrls = await Promise.all(
    document.files.map(async (file) => ({
      file,
      url: await getSignedDocumentUrl(file.storage_path),
    })),
  );

  return (
    <DocumentViewer
      document={document}
      fileUrls={fileUrls}
      categories={categories}
      members={membersRes.data ?? []}
    />
  );
}
