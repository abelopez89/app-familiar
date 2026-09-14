import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { TemplateItemsList } from "./template-items-list";
import { TemplateHeader } from "./template-header";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("shopping_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (!template) notFound();

  const [{ data: items }, { data: categories }, { data: otherTemplates }] = await Promise.all([
    supabase
      .from("template_items")
      .select("*")
      .eq("template_id", id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("product_categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("shopping_templates").select("*").neq("id", id).eq("is_active", true),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <TemplateHeader template={template} />
      <TemplateItemsList
        templateId={template.id}
        items={items ?? []}
        categories={categories ?? []}
        otherTemplates={otherTemplates ?? []}
      />
    </div>
  );
}
