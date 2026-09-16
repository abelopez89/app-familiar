"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackButton } from "./back-button";
import { ROOT_PATHS, sectionLabelFor } from "./modules";

/**
 * Header de vidrio, fino y contextual.
 *
 * En las pantallas del tab bar muestra el nombre de la familia; en
 * cualquier pantalla interna muestra el módulo en el que estás parado
 * ("Compras" mientras editás una plantilla), que es justo el dato que se
 * pierde cuando bajás tres niveles. Ya no lleva engranaje: configuración
 * es una pestaña propia, y tener dos entradas al mismo lugar era parte
 * de la ambigüedad que este rediseño saca.
 */
export function AppHeader({ familyName }: { familyName: string }) {
  const pathname = usePathname();
  const isRoot = ROOT_PATHS.has(pathname);
  const label = isRoot ? familyName : (sectionLabelFor(pathname) ?? familyName);

  return (
    <header
      className="glass sticky top-0 z-30 border-b"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <div className="mx-auto flex h-13 max-w-lg items-center gap-1 px-3">
        <BackButton />
        {isRoot ? (
          <span className="truncate text-sm font-semibold text-muted-foreground">{label}</span>
        ) : (
          <Link
            href="/"
            className="truncate text-sm font-semibold text-muted-foreground transition-colors active:text-foreground"
          >
            {label}
          </Link>
        )}
      </div>
    </header>
  );
}
