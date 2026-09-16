import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { listDocumentCategories, getStorageUsageBytes } from "@/lib/documents/queries";
import { formatBytes } from "@/lib/format";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { CategoriesList } from "./categories-list";

const FREE_TIER_LIMIT_BYTES = 1024 * 1024 * 1024;

export default async function ConfigDocumentosPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const [categories, usageBytes] = await Promise.all([listDocumentCategories(), getStorageUsageBytes()]);
  const usagePercent = Math.min(100, Math.round((usageBytes / FREE_TIER_LIMIT_BYTES) * 100));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Documentos" description="Categorías y espacio usado" />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Espacio usado</span>
          <span className="text-muted-foreground tabular-nums">
            {formatBytes(usageBytes)} de {formatBytes(FREE_TIER_LIMIT_BYTES)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${usagePercent >= 90 ? "bg-destructive" : "bg-mod-documentos"}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      <SectionTitle>Categorías</SectionTitle>
      <CategoriesList categories={categories} />
    </div>
  );
}
