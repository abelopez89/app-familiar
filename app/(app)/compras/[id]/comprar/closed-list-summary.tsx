import Link from "next/link";
import { ArrowLeft, BadgePercent, CheckCircle2 } from "lucide-react";
import type { PromoUso, ShoppingList, ShoppingListItem } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { formatGuaranies, formatQuantity } from "@/lib/format";
import { DeleteListButton } from "../delete-list-button";
import { RenameListDialog } from "../rename-list-dialog";

export function ClosedListSummary({
  list,
  items,
  uso,
}: {
  list: ShoppingList;
  items: ShoppingListItem[];
  uso: PromoUso | null;
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

      <Card className="gap-0 py-0">
        <CardContent className="flex flex-col gap-2 p-4 text-sm">
          {uso ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                <BadgePercent className="size-4 text-mod-promos" />
                {uso.promo_titulo} · {uso.tarjeta_alias}
              </p>
              <p className="text-muted-foreground">
                En caja {formatGuaranies(uso.monto_caja)}
                {uso.descuento_caja > 0 ? ` (−${formatGuaranies(uso.descuento_caja)})` : ""}
                {uso.reintegro > 0
                  ? ` · reintegro ${formatGuaranies(uso.reintegro)}${uso.reintegro_acreditado ? " acreditado" : " pendiente"}`
                  : ""}
              </p>
              <Button asChild variant="outline" size="sm" className="self-start">
                <Link href={`/promos/usar?compra=${list.id}`}>Cambiar promo</Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/promos/usar?compra=${list.id}`}>
                <BadgePercent className="size-4" />
                ¿Pagaste con una promo de tarjeta?
              </Link>
            </Button>
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
