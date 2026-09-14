import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { NewListWizard } from "./new-list-wizard";

export default async function NuevaListaPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("shopping_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: items } = await supabase
    .from("template_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Nueva lista de compras</h1>
      <NewListWizard templates={templates ?? []} items={items ?? []} />
    </div>
  );
}
