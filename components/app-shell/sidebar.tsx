import { House, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAUNCHER_MODULES, type ModuleKey } from "./modules";
import { Nanduti } from "./nanduti";
import { SidebarLink } from "./sidebar-link";

/*
 * Sobre el verde del menú los íconos van en el verde claro de la marca; el
 * del ítem activo (fondo `card`) toma el color de su módulo. Clases
 * completas a propósito: Tailwind no genera `text-mod-${key}`.
 */
const ACTIVE_FG: Record<ModuleKey, string> = {
  compras: "group-aria-[current=page]:text-mod-compras",
  eventos: "group-aria-[current=page]:text-mod-eventos",
  tareas: "group-aria-[current=page]:text-mod-tareas",
  gastos: "group-aria-[current=page]:text-mod-gastos",
  combustible: "group-aria-[current=page]:text-mod-combustible",
  documentos: "group-aria-[current=page]:text-mod-documentos",
  promos: "group-aria-[current=page]:text-mod-promos",
  familia: "group-aria-[current=page]:text-mod-familia",
};
const ICON = "size-[18px] shrink-0 text-brand-muted";

/**
 * Menú lateral fijo del panel web de escritorio. Solo se ve desde `lg:`
 * (≥ 1024px), donde reemplaza al header y al tab bar; por debajo queda
 * `hidden` y el celular sigue exactamente como antes.
 *
 * Las entradas salen de `LAUNCHER_MODULES` (`modules.ts` sigue siendo la
 * única fuente de verdad, y ya respeta `FEATURES.tareas`). Es un Server
 * Component: no consulta nada (familia y miembro llegan del layout, que
 * ya los tiene por `getCurrentFamilyContext()`), y solo `SidebarLink`
 * es de cliente.
 */
export function Sidebar({
  familyName,
  memberName,
  memberColor,
}: {
  familyName: string;
  memberName: string;
  memberColor: string;
}) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-(--sidebar-width) flex-col bg-brand text-brand-foreground lg:flex"
      aria-label="Menú principal"
    >
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Nanduti detail="simple" strokeWidth={4} className="size-9 shrink-0 text-brand-muted" />
        <div className="min-w-0">
          <p className="font-heading truncate text-base font-bold">{familyName}</p>
          <p className="text-xs text-brand-muted">Panel familiar</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          <li>
            <SidebarLink href="/">
              <House className={cn(ICON, "group-aria-[current=page]:text-primary")} />
              Inicio
            </SidebarLink>
          </li>
          {LAUNCHER_MODULES.map((m) => (
            <li key={m.key}>
              <SidebarLink href={m.href}>
                <m.icon className={cn(ICON, ACTIVE_FG[m.key])} />
                <span className="truncate">{m.label}</span>
              </SidebarLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-brand-line/40 px-3 pt-3 pb-4">
        <SidebarLink href="/config" exclude={["/config/miembros"]}>
          <Settings className={cn(ICON, "group-aria-[current=page]:text-primary")} />
          Ajustes
        </SidebarLink>
        <div className="mt-2 flex items-center gap-3 px-3 py-2">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
            style={{ backgroundColor: memberColor }}
            aria-hidden
          >
            {memberName.trim().charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm">{memberName}</span>
        </div>
      </div>
    </aside>
  );
}
