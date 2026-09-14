"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, ListChecks, MoreHorizontal, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/tareas", label: "Tareas", icon: ListChecks },
  { href: "/mas", label: "Más", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
