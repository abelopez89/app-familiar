import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estado vacío consistente. Un vacío sin explicación se lee como un
 * error de carga; este componente obliga a decir qué falta y, cuando
 * corresponde, a ofrecer la acción que lo resuelve.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </span>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-[32ch] text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
