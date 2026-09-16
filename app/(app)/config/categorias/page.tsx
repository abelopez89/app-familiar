import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { PageHeader } from "@/components/app-shell/page-header";
import { CategoriesList } from "./categories-list";

export default async function ConfigCategoriasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Categorías"
        description="El orden es el recorrido del súper. Arrastrá para reordenar."
      />
      <CategoriesList categories={categories ?? []} />
    </div>
  );
}
