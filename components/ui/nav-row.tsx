import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fila de navegación de una lista de ajustes o de un índice de módulo.
 * Alto mínimo de 44px (`tap-target`) porque es el blanco táctil mínimo
 * de las guías de Apple, y feedback con `active:` en vez del destello
 * gris por defecto de iOS.
 */
export function NavRow({
  href,
  icon: Icon,
  iconFg,
  iconBg,
  label,
  description,
  value,
  className,
}: {
  href: string;
  icon?: LucideIcon;
  iconFg?: string;
  iconBg?: string;
  label: string;
  description?: string;
  value?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "tap-target flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            iconBg ?? "bg-muted",
          )}
        >
          <Icon className={cn("size-4", iconFg ?? "text-muted-foreground")} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {description && (
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      {value && <span className="shrink-0 text-sm text-muted-foreground">{value}</span>}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}

/** Contenedor de filas agrupadas, al estilo de los ajustes de iOS. */
export function NavGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
