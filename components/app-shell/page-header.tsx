import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Encabezado estándar de pantalla: un `h1` grande, una línea de apoyo
 * opcional y un slot de acciones a la derecha. Antes cada pantalla
 * escribía su propio `<h1 className="text-xl font-semibold">` con un
 * `flex justify-between` alrededor, y ninguna coincidía del todo con
 * otra. Usar este componente es lo que hace que todas las pantallas se
 * lean como parte de la misma app.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  iconFg,
  iconBg,
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconFg?: string;
  iconBg?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              iconBg ?? "bg-accent",
            )}
          >
            <Icon className={cn("size-5.5", iconFg ?? "text-accent-foreground")} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[1.75rem] font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </div>
  );
}

/** Rótulo de grupo dentro de una pantalla (por encima de una lista). */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between px-1", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}
