"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, ListChecks, Settings, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cinco destinos: inicio, los tres módulos que se abren todos los días y
 * configuración. Combustible, documentos y la ficha de cada miembro no
 * están acá a propósito — viven en la grilla del inicio, que ahora es un
 * lanzador y no un tablero. Es lo que permitió borrar la pestaña "Más",
 * que mezclaba módulos con ajustes y no decía a dónde llevaba ninguno.
 */
const items = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/eventos", label: "Calendario", icon: CalendarDays },
  { href: "/tareas", label: "Tareas", icon: ListChecks },
  { href: "/config", label: "Ajustes", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 border-t"
      // El inset de seguridad del iPhone va como padding del propio tab
      // bar: así la barra se pinta hasta el borde inferior de la pantalla
      // pero los íconos quedan por encima del indicador de inicio.
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center gap-1 px-1 pb-2 pt-2"
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span
                  className={cn(
                    "text-[0.6875rem] font-medium leading-none transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
