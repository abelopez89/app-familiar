import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { FamilyNameForm } from "./family-name-form";

export default async function ConfigFamiliaPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Familia</h1>
      <FamilyNameForm initialName={context.family.name} />
    </div>
  );
}
