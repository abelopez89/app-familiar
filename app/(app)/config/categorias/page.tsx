import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
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
      <div>
        <h1 className="text-xl font-semibold">Categorías de productos</h1>
        <p className="text-sm text-muted-foreground">
          El orden representa el recorrido físico del supermercado.
          Arrastrá para reordenar.
        </p>
      </div>
      <CategoriesList categories={categories ?? []} />
    </div>
  );
}
