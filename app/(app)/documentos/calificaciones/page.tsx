import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getCurrentFamilyContext } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";
import { listReports } from "@/lib/calificaciones/queries";
import { MODULES_BY_KEY } from "@/components/app-shell/modules";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VistaCalificaciones } from "./vista";

/**
 * Resumen de calificaciones por hijo y año: acumulado por materia (suma de
 * puntos sobre suma de máximos), mes a mes y los informes cargados. Hijo y
 * año van en la URL (`?miembro=<id>&anio=<yyyy>`), sin JS de cliente.
 */
export default async function CalificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ miembro?: string; anio?: string }>;
}) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");
  const params = await searchParams;

  const informes = await listReports(context.family.id);
  const modulo = MODULES_BY_KEY.documentos;
  if (informes.length === 0) {
    return (
      <div className="flex flex-col gap-5 pb-nav">
        <PageHeader title="Calificaciones" icon={GraduationCap} iconFg={modulo.fg} iconBg={modulo.bg} />
        <EmptyState
          icon={GraduationCap}
          title="Todavía no hay calificaciones"
          description="Cargá el informe mensual del colegio en PDF y acá vas a ver los puntajes de cada materia."
          action={
            <Button asChild>
              <Link href="/documentos/calificaciones/cargar">Cargar calificaciones</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const memberIds = [...new Set(informes.map((i) => i.memberId))];
  const supabase = await createClient();
  const { data: miembros } = await supabase
    .from("family_members")
    .select("id, display_name")
    .eq("family_id", context.family.id)
    .in("id", memberIds)
    .order("created_at", { ascending: true });
  const hijos = (miembros ?? []).filter((m) => memberIds.includes(m.id));

  const hijo = hijos.find((m) => m.id === params.miembro) ?? hijos[0];
  const delHijo = informes.filter((i) => i.memberId === hijo?.id);
  const anios = [...new Set(delHijo.map((i) => i.year))].sort((a, b) => b - a);
  const anio = anios.find((a) => String(a) === params.anio) ?? anios[0];
  const delAnio = delHijo.filter((i) => i.year === anio);
  return <VistaCalificaciones hijos={hijos} hijo={hijo} anios={anios} anio={anio} delAnio={delAnio} />;
}
