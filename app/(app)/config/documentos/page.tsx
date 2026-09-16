import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listDocumentCategories, getStorageUsageBytes } from "@/lib/documents/queries";
import { formatBytes } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { CategoriesList } from "./categories-list";

const FREE_TIER_LIMIT_BYTES = 1024 * 1024 * 1024;

export default async function ConfigDocumentosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [categories, usageBytes] = await Promise.all([listDocumentCategories(), getStorageUsageBytes()]);
  const usagePercent = Math.min(100, Math.round((usageBytes / FREE_TIER_LIMIT_BYTES) * 100));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Documentos</h1>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span>Espacio usado</span>
            <span className="text-muted-foreground">
              {formatBytes(usageBytes)} de {formatBytes(FREE_TIER_LIMIT_BYTES)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${usagePercent}%` }} />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">Categorías</h2>
      </div>
      <CategoriesList categories={categories} />
    </div>
  );
}
