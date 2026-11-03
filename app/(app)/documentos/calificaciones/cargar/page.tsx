import { notFound, redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader } from "@/components/app-shell/page-header";
import { CargarInforme } from "./cargar-informe";

/**
 * Cargar el informe mensual del colegio: el PDF va al Centro de Documentos
 * (tipo "calificaciones", del hijo) y sus puntajes se leen y se revisan en
 * una vista previa editable antes de guardarlos. Con `?doc=<id>` edita o
 * lee los puntajes de un informe que ya está en Documentos.
 */
export default async function CargarCalificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");
  const { doc } = await searchParams;

  const supabase = await createClient();
  const [{ data: members }, documento] = await Promise.all([
    supabase
      .from("family_members")
      .select("id, display_name")
      .eq("family_id", context.family.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    doc
      ? supabase
          .from("documents")
          .select("id, title, member_id")
          .eq("family_id", context.family.id)
          .eq("id", doc)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);
  if (doc && !documento) notFound();

  const modulo = MODULES_BY_KEY.documentos;
  return (
    <div className="flex flex-col gap-6 pb-nav">
      <PageHeader
        title={documento ? "Puntajes del informe" : "Cargar calificaciones"}
        description={
          documento ? documento.title : "El informe mensual del colegio, en PDF. Revisás los puntajes antes de guardar."
        }
        icon={GraduationCap}
        iconFg={modulo.fg}
        iconBg={modulo.bg}
      />
      <CargarInforme members={members ?? []} documento={documento} />
    </div>
  );
}
