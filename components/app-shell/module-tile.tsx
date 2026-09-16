import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ModuleDef } from "./modules";

/**
 * Acceso directo a un módulo en la pantalla de inicio.
 *
 * El inicio es una grilla de estos, no un tablero: el primer toque
 * después de abrir la app tiene que ser "a dónde voy", no "qué leo". El
 * `badge` es el único dato que viaja hasta acá, y solo cuando hay algo
 * que reclama atención (tareas vencidas, documentos por vencer) — un
 * número que siempre está presente deja de significar nada.
 */
export function ModuleTile({
  module,
  badge,
  badgeTone = "default",
  hint,
}: {
  module: ModuleDef;
  badge?: number;
  badgeTone?: "default" | "alert";
  hint?: string;
}) {
  const { href, label, tagline, icon: Icon, fg, bg } = module;

  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-transform duration-150 active:scale-[0.97]"
    >
      <span className={cn("flex size-11 items-center justify-center rounded-xl", bg)}>
        <Icon className={cn("size-5.5", fg)} />
      </span>

      <span className="min-w-0">
        <span className="block truncate font-semibold">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {hint ?? tagline}
        </span>
      </span>

      {badge != null && badge > 0 && (
        <span
          className={cn(
            "absolute right-3 top-3 flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            badgeTone === "alert"
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
