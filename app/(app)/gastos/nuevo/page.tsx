import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listActiveMembers } from "@/lib/members";
import { PageHeader } from "@/components/app-shell/page-header";
import { GroupForm } from "../group-form";

export default async function NuevoGrupoPage({ searchParams }: { searchParams: Promise<{ rapido?: string }> }) {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const { rapido } = await searchParams;
  const quick = rapido === "1";
  const members = await listActiveMembers();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={quick ? "Grupo rápido" : "Nuevo grupo"}
        description={quick ? "Nombre, quiénes, y a cargar el primer gasto." : "Un viaje, un evento, una salida."}
      />
      <GroupForm members={members} quick={quick} />
    </div>
  );
}
