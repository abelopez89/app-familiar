import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { TemplatesList } from "./templates-list";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function PlantillasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("shopping_templates")
    .select("*")
    .order("sort_order", { ascending: true });

  const { data: itemCounts } = await supabase
    .from("template_items")
    .select("template_id")
    .eq("is_active", true);

  const counts = new Map<string, number>();
  for (const row of itemCounts ?? []) {
    counts.set(row.template_id, (counts.get(row.template_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Plantillas" description="La base de cada lista nueva" />
      <TemplatesList
        templates={templates ?? []}
        itemCounts={Object.fromEntries(counts)}
      />
    </div>
  );
}
