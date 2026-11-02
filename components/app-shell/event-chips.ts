import type { EventCategory } from "@/lib/supabase/types";

/**
 * Color de los chips de eventos por categoría en las vistas de escritorio
 * (tablero del inicio y, después, el calendario). Reusa los pares de
 * tokens de módulo de `globals.css` en vez de inventar colores nuevos:
 * así el modo oscuro sale solo. Clases escritas completas para que
 * Tailwind las vea (análisis estático, ver `modules.ts`).
 */
export const EVENT_CATEGORY_CHIP: Record<EventCategory, string> = {
  escolar: "bg-mod-combustible-soft text-mod-combustible",
  medico: "bg-mod-documentos-soft text-mod-documentos",
  familiar: "bg-mod-gastos-soft text-mod-gastos",
  cumpleanos: "bg-mod-promos-soft text-mod-promos",
  otro: "bg-muted text-muted-foreground",
};
