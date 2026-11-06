"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Un ítem del menú lateral de escritorio. Es lo único del menú que corre
 * en el cliente (necesita la ruta actual para marcar el activo): el resto
 * se arma en el servidor, así el celular, que nunca ve el menú, no suma
 * más JS que este componente.
 *
 * `exclude` resuelve los prefijos anidados: `/config/miembros` es
 * "Familia", no "Ajustes".
 */
export function SidebarLink({
  href,
  exclude,
  children,
}: {
  href: string;
  exclude?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const matches = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const isActive =
    href === "/" ? pathname === "/" : matches(href) && !(exclude ?? []).some(matches);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
        // Sobre el verde de la marca: el activo es una "hoja" blanca.
        isActive
          ? "bg-card font-bold text-foreground"
          : "text-brand-foreground hover:bg-brand-foreground/10",
      )}
    >
      {children}
    </Link>
  );
}
