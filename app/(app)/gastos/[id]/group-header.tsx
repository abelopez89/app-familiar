import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { GroupBundle } from "@/lib/expenses/queries";
import { balanceTone, describeBalance } from "@/lib/expenses/constants";
import { formatGuaranies } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GroupMenu } from "./group-menu";

/**
 * Encabezado de un grupo: total y balance de quien mira, siempre visibles
 * y calculados sobre los datos actuales (en vivo, desde el primer gasto
 * y sin importar si el grupo está abierto o cerrado). Debajo, las dos
 * pestañas: Gastos y Balances.
 */
export function GroupHeader({
  bundle,
  memberId,
  active,
}: {
  bundle: GroupBundle;
  memberId: string;
  active: "gastos" | "balances";
}) {
  const { group, participants, balances, totalPyg } = bundle;
  const me = participants.find((p) => p.member_id === memberId);
  const myBalance = me ? (balances.balances.find((b) => b.participantId === me.id)?.balance ?? 0) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[2rem] leading-tight font-bold tracking-tight">{group.name}</h1>
          {group.status === "cerrado" && (
            <Badge variant="outline" className="mt-1">
              Cerrado
            </Badge>
          )}
        </div>
        <GroupMenu group={group} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="hoja min-w-0 px-4 py-3.5">
          <p className="text-sm text-muted-foreground">Total del grupo</p>
          <p className="font-heading truncate text-xl font-bold tabular-nums">{formatGuaranies(totalPyg)}</p>
        </div>
        <div className="hoja min-w-0 px-4 py-3.5">
          <p className="text-sm text-muted-foreground">Tu balance</p>
          {!balances.isConsistent ? (
            <p className="flex items-center gap-1 text-sm font-bold text-destructive">
              <AlertTriangle className="size-4" />
              No cierra
            </p>
          ) : myBalance === null ? (
            <p className="text-sm text-muted-foreground">No participás</p>
          ) : (
            <p className={cn("font-heading text-lg leading-tight font-bold tabular-nums", balanceTone(myBalance))}>
              {describeBalance(myBalance, formatGuaranies)}
            </p>
          )}
        </div>
      </div>

      <nav className="grid grid-cols-2 rounded-full bg-muted p-1 text-sm font-bold">
        {(
          [
            { key: "gastos", label: "Gastos", href: `/gastos/${group.id}` },
            { key: "balances", label: "Balances", href: `/gastos/${group.id}/balances` },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "tap-target flex items-center justify-center rounded-full px-3 py-2 transition-colors",
              active === tab.key ? "bg-card text-foreground" : "text-muted-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
