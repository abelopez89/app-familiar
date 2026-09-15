import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ShoppingList } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { DeleteListButton } from "./delete-list-button";

export function ListHeader({ list }: { list: ShoppingList }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/compras">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{list.name ?? "Lista de compras"}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(list.shopping_date)}</p>
        </div>
      </div>
      <DeleteListButton listId={list.id} />
    </div>
  );
}
