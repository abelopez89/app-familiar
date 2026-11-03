import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listDocumentCategories } from "@/lib/documents/queries";
import { createClient } from "@/lib/supabase/server";
import { DocumentUploadForm } from "./document-upload-form";

export default async function NuevoDocumentoPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const [categories, membersRes] = await Promise.all([
    listDocumentCategories(),
    supabase.from("family_members").select("*").eq("is_active", true).order("created_at", { ascending: true }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Nuevo documento</h1>
      <p className="text-sm text-muted-foreground">
        ¿Es el informe de calificaciones del colegio?{" "}
        <Link href="/documentos/calificaciones/cargar" className="font-medium text-foreground underline">
          Cargalo acá
        </Link>{" "}
        y se leen los puntajes de cada materia.
      </p>
      <DocumentUploadForm categories={categories} members={membersRes.data ?? []} />
    </div>
  );
}
