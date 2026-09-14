import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { getKnownProductNames } from "@/lib/shopping/autocomplete";
import { ListEditor } from "./list-editor";
import { ListHeader } from "./list-header";

export default async function ShoppingListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (!list) notFound();

  if (list.status === "cerrada") {
    redirect(`/compras/${id}/comprar`);
  }

  const [{ data: items }, { data: categories }, { data: templates }, knownNames] =
    await Promise.all([
      supabase
        .from("shopping_list_items")
        .select("*")
        .eq("list_id", id)
        .order("sort_order", { ascending: true }),
      supabase.from("product_categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("shopping_templates").select("*").eq("is_active", true),
      getKnownProductNames(),
    ]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <ListHeader list={list} />
      <ListEditor
        list={list}
        items={items ?? []}
        categories={categories ?? []}
        templates={templates ?? []}
        knownNames={knownNames}
      />
    </div>
  );
}
