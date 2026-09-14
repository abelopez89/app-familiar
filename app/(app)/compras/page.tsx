import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Plus, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamilyContext } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatGuaranies } from "@/lib/format";

export default async function ComprasPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const supabase = await createClient();

  const { data: openLists } = await supabase
    .from("shopping_lists")
    .select("*")
    .in("status", ["abierta", "en_curso"])
    .order("created_at", { ascending: false });

  const { data: closedLists } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("status", "cerrada")
    .order("closed_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Compras</h1>
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/compras/plantillas">
            <ClipboardList className="size-4" />
            Plantillas
          </Link>
        </Button>
      </div>

      <Button asChild size="lg" className="gap-2">
        <Link href="/compras/nueva">
          <Plus className="size-4" />
          Nueva lista de compras
        </Link>
      </Button>

      {openLists && openLists.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">Abiertas</p>
          {openLists.map((list) => (
            <Link key={list.id} href={`/compras/${list.id}`}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="size-4" />
                    {list.name ?? "Lista de compras"}
                  </CardTitle>
                  <CardDescription>
                    {list.status === "en_curso" ? "En curso" : "Abierta"} ·{" "}
                    {formatDate(list.shopping_date)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {closedLists && closedLists.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">Historial</p>
          {closedLists.map((list) => (
            <Card key={list.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{list.name ?? "Lista de compras"}</p>
                  <p className="text-xs text-muted-foreground">
                    {list.closed_at ? formatDateTime(list.closed_at) : formatDate(list.shopping_date)}
                  </p>
                </div>
                {list.total_amount != null && (
                  <p className="text-sm font-medium">{formatGuaranies(list.total_amount)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
