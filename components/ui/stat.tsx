import { cn } from "@/lib/utils";

/** Par rótulo/valor, para las grillas de métricas de combustible y tareas. */
export function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
