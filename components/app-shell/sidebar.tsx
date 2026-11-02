import { House, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAUNCHER_MODULES } from "./modules";
import { SidebarLink } from "./sidebar-link";

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
      className="fixed inset-y-0 left-0 z-40 hidden w-(--sidebar-width) flex-col border-r bg-muted lg:flex"
      aria-label="Menú principal"
    >
      <div className="px-5 pt-6 pb-5">
        <p className="truncate text-base font-semibold text-foreground">{familyName}</p>
        <p className="text-xs text-muted-foreground">Panel familiar</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          <li>
            <SidebarLink href="/">
              <House className="size-[18px] text-foreground" />
              Inicio
            </SidebarLink>
          </li>
          {LAUNCHER_MODULES.map((m) => (
            <li key={m.key}>
              <SidebarLink href={m.href}>
                <m.icon className={cn("size-[18px]", m.fg)} />
                <span className="truncate">{m.label}</span>
              </SidebarLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t px-3 pt-3 pb-4">
        <SidebarLink href="/config" exclude={["/config/miembros"]}>
          <Settings className="size-[18px] text-muted-foreground" />
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
          <span className="truncate text-sm text-foreground">{memberName}</span>
        </div>
      </div>
    </aside>
  );
}
