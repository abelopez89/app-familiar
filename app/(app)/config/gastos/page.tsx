import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listExpenseCategories } from "@/lib/expenses/queries";
import { PageHeader } from "@/components/app-shell/page-header";
import { ExpenseCategoriesList } from "./categories-list";

export default async function ConfigGastosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const categories = await listExpenseCategories();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Categorías de gastos" description="Los chips del formulario de gasto compartido" />
      <ExpenseCategoriesList categories={categories} />
    </div>
  );
}
