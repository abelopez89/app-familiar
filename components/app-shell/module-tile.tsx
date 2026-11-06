import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ModuleDef } from "./modules";

/**
 * Acceso directo a un módulo en la pantalla de inicio: un ícono grande
 * sobre el fondo tintado del módulo y el nombre debajo, en una grilla de
 * cuatro (identidad "Lapacho y tereré"; antes eran tarjetas de a dos).
 *
 * El inicio es una grilla de estos, no un tablero: el primer toque
 * después de abrir la app tiene que ser "a dónde voy", no "qué leo". El
 * `badge` con número es el único dato visible, y solo cuando hay algo que
 * reclama atención (tareas vencidas, documentos por vencer) — un número
 * que siempre está presente deja de significar nada. El `hint` ya no se
 * ve (no entra debajo de un ícono): queda para el lector de pantalla.
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
  const { href, label, icon: Icon, fg, bg } = module;

  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center gap-2 text-center transition-transform duration-150 active:scale-[0.95]"
    >
      <span className={cn("flex size-15 items-center justify-center rounded-[1.25rem]", bg)}>
        <Icon className={cn("size-6.5", fg)} />
      </span>

      <span className="w-full truncate text-xs font-bold">{label}</span>
      {hint && <span className="sr-only">{hint}</span>}

      {badge != null && badge > 0 && (
        <span
          className={cn(
            "absolute -top-1.5 right-0.5 flex min-w-6 items-center justify-center rounded-full border-2 border-background px-1.5 py-0.5 text-xs font-bold tabular-nums",
            badgeTone === "alert"
              ? "bg-warning text-warning-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
