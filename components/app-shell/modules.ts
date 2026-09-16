import {
  CalendarDays,
  FileText,
  Fuel,
  ListChecks,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey =
  | "compras"
  | "eventos"
  | "tareas"
  | "combustible"
  | "documentos"
  | "familia";

export type ModuleDef = {
  key: ModuleKey;
  href: string;
  label: string;
  /** Una línea, en voseo, que dice para qué sirve el módulo. */
  tagline: string;
  icon: LucideIcon;
  /** Color del ícono. */
  fg: string;
  /** Fondo tintado detrás del ícono. */
  bg: string;
};

/**
 * Los seis módulos de la app, en el orden en que aparecen en el inicio.
 *
 * Esta lista es la única fuente de verdad del "ecosistema": la grilla de
 * accesos directos del inicio, los encabezados de cada pantalla y los
 * chips de color salen todos de acá. Las clases de color van escritas
 * completas a propósito — Tailwind hace análisis estático del fuente, así
 * que `text-mod-${key}` no generaría ninguna clase.
 */
export const MODULES: ModuleDef[] = [
  {
    key: "compras",
    href: "/compras",
    label: "Compras",
    tagline: "Listas y supermercado",
    icon: ShoppingCart,
    fg: "text-mod-compras",
    bg: "bg-mod-compras-soft",
  },
  {
    key: "eventos",
    href: "/eventos",
    label: "Calendario",
    tagline: "Eventos y cumpleaños",
    icon: CalendarDays,
    fg: "text-mod-eventos",
    bg: "bg-mod-eventos-soft",
  },
  {
    key: "tareas",
    href: "/tareas",
    label: "Tareas",
    tagline: "Mantenimiento del hogar",
    icon: ListChecks,
    fg: "text-mod-tareas",
    bg: "bg-mod-tareas-soft",
  },
  {
    key: "combustible",
    href: "/combustible",
    label: "Combustible",
    tagline: "Cargas y rendimiento",
    icon: Fuel,
    fg: "text-mod-combustible",
    bg: "bg-mod-combustible-soft",
  },
  {
    key: "documentos",
    href: "/documentos",
    label: "Documentos",
    tagline: "Cédulas, seguros, recetas",
    icon: FileText,
    fg: "text-mod-documentos",
    bg: "bg-mod-documentos-soft",
  },
  {
    key: "familia",
    href: "/config/miembros",
    label: "Familia",
    tagline: "Fichas de cada miembro",
    icon: Users,
    fg: "text-mod-familia",
    bg: "bg-mod-familia-soft",
  },
];

export const MODULES_BY_KEY = Object.fromEntries(
  MODULES.map((m) => [m.key, m]),
) as Record<ModuleKey, ModuleDef>;

/**
 * Rótulo de la sección actual para el header, del prefijo más específico
 * al más general. Sirve para que en `/compras/plantillas/[id]` el header
 * diga "Compras" y no el nombre de la familia: saber en qué módulo estás
 * parado es lo que evita la ambigüedad al navegar en profundidad.
 */
const SECTION_LABELS: Array<[prefix: string, label: string]> = [
  ["/config", "Configuración"],
  ["/compras", "Compras"],
  ["/eventos", "Calendario"],
  ["/tareas", "Tareas"],
  ["/combustible", "Combustible"],
  ["/documentos", "Documentos"],
];

export function sectionLabelFor(pathname: string): string | null {
  for (const [prefix, label] of SECTION_LABELS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label;
  }
  return null;
}

/**
 * Las cinco pantallas del tab bar. Son destinos de navegación primaria:
 * no llevan botón de volver (no se "entra" a ellas desde ningún lado) y
 * el header muestra el nombre de la familia en vez del rótulo de sección,
 * que ahí sería redundante con el título de la propia pantalla.
 */
export const ROOT_PATHS = new Set(["/", "/compras", "/eventos", "/tareas", "/config"]);
