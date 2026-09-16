import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { FamilyNameForm } from "./family-name-form";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function ConfigFamiliaPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Familia" description="Cómo se llama tu casa dentro de la app" />
      <FamilyNameForm initialName={context.family.name} />
    </div>
  );
}
