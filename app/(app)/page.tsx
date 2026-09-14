import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getOpenShoppingList } from "@/lib/shopping/queries";
import { formatDate } from "@/lib/dates";

export default async function HoyPage() {
  const openList = await getOpenShoppingList();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Hoy</h1>

      {openList ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5" />
              {openList.name ?? "Lista de compras"}
            </CardTitle>
            <CardDescription>
              {openList.status === "en_curso" ? "En curso" : "Abierta"} ·{" "}
              {formatDate(openList.shopping_date)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/compras/${openList.id}`}>Ver lista</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No tenés una lista de compras abierta</CardTitle>
            <CardDescription>
              Creá una nueva lista a partir de tus plantillas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/compras/nueva">Nueva lista de compras</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
