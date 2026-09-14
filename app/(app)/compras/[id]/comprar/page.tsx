import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { markListInProgress } from "./actions";
import { SupermercadoView } from "./supermercado-view";
import { ClosedListSummary } from "./closed-list-summary";

export default async function ComprarPage({
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
    const { data: items } = await supabase
      .from("shopping_list_items")
      .select("*")
      .eq("list_id", id);
    return <ClosedListSummary list={list} items={items ?? []} />;
  }

  if (list.status === "abierta") {
    await markListInProgress(id);
  }

  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("*")
      .eq("list_id", id)
      .order("sort_order", { ascending: true }),
    supabase.from("product_categories").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <SupermercadoView
      listId={id}
      initialItems={items ?? []}
      categories={categories ?? []}
    />
  );
}
