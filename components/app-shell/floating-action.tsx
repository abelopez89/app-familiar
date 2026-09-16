import { cn } from "@/lib/utils";

/**
 * Posiciona el botón de acción principal de una pantalla por encima del
 * tab bar.
 *
 * Existe para que `--nav-total` (alto del tab bar + inset de seguridad
 * del iPhone) esté escrito en un solo lugar: antes cada pantalla ponía
 * `bottom-20` a mano, un número que no contempla el indicador de inicio
 * y que dejaba el botón medio tapado en un iPhone sin botón físico.
 */
export function FloatingAction({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("fixed right-4 z-30", className)}
      style={{ bottom: "calc(var(--nav-total) + 0.75rem)" }}
    >
      {children}
    </div>
  );
}

/**
 * Barra fija de acción al pie de una pantalla (cerrar compra, guardar
 * lista). Mismo motivo que `FloatingAction`: un solo origen para el alto
 * del tab bar y el inset de seguridad.
 */
export function StickyBottomBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("glass fixed inset-x-0 z-30 mx-auto max-w-lg border-t px-4 py-3", className)}
      style={{ bottom: "var(--nav-total)" }}
    >
      {children}
    </div>
  );
}
