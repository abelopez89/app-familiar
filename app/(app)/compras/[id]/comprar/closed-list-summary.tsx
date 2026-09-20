import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { ShoppingList, ShoppingListItem } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { formatGuaranies, formatQuantity } from "@/lib/format";
import { DeleteListButton } from "../delete-list-button";
import { RenameListDialog } from "../rename-list-dialog";

export function ClosedListSummary({
  list,
  items,
}: {
  list: ShoppingList;
  items: ShoppingListItem[];
}) {
  const checkedCount = items.filter((i) => i.is_checked).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compras">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">{list.name ?? "Lista de compras"}</h1>
        </div>
        <div className="flex items-center">
          <RenameListDialog list={list} />
          <DeleteListButton listId={list.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-5 text-primary" />
            Compra cerrada
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          {list.closed_at && <p>{formatDateTime(list.closed_at)}</p>}
          <p>
            {checkedCount} de {items.length} productos comprados
          </p>
          {list.total_amount != null && (
            <p className="text-base font-medium text-foreground">
              Total: {formatGuaranies(list.total_amount)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className={item.is_checked ? "text-muted-foreground line-through" : ""}>
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatQuantity(item.quantity, item.unit)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
