import { redirect } from "next/navigation";
import {
  CalendarDays,
  Car,
  UserRound,
  FolderTree,
  Home,
  ListTodo,
  LogOut,
  Send,
  Tags,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavGroup, NavRow } from "@/components/ui/nav-row";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { getCurrentFamilyContext } from "@/lib/family";
import { logout } from "@/app/(auth)/actions";

/**
 * Configuración: una sola sección para todo lo que se ajusta una vez y
 * después no se toca.
 *
 * Reemplaza a la pestaña "Más", que mezclaba ajustes reales (miembros,
 * Telegram) con módulos enteros (documentos, combustible) en una misma
 * lista plana, de modo que ninguna fila decía si llevaba a una pantalla
 * de uso diario o a un formulario de configuración. Los módulos se
 * fueron a la grilla del inicio; acá quedaron solo los ajustes, y
 * agrupados por a qué pertenecen.
 */
const GRUPOS: Array<{
  titulo: string;
  descripcion?: string;
  filas: Array<{
    href: string;
    label: string;
    description: string;
    icon: typeof Home;
  }>;
}> = [
  {
    titulo: "Tu familia",
    filas: [
      {
        href: "/config/familia",
        label: "Datos de la familia",
        description: "Nombre con el que aparece en la app",
        icon: Home,
      },
      {
        href: "/config/miembros",
        label: "Miembros",
        description: "Quiénes son y la ficha de cada uno",
        icon: Users,
      },
    ],
  },
  {
    titulo: "Catálogos",
    descripcion: "Lo que cada módulo usa como base.",
    filas: [
      {
        href: "/config/categorias",
        label: "Categorías de productos",
        description: "El recorrido del supermercado",
        icon: Tags,
      },
      {
        href: "/config/documentos",
        label: "Categorías de documentos",
        description: "Y el espacio usado en la nube",
        icon: FolderTree,
      },
      {
        href: "/tareas/activos",
        label: "Activos del hogar",
        description: "Electrodomésticos, instalaciones, vehículos",
        icon: Wrench,
      },
      {
        href: "/tareas/definiciones",
        label: "Definiciones de tareas",
        description: "Qué se hace cada cuánto",
        icon: ListTodo,
      },
      {
        href: "/combustible/vehiculos",
        label: "Vehículos",
        description: "Tanque, combustible y odómetro inicial",
        icon: Car,
      },
    ],
  },
  {
    titulo: "Avisos y sincronización",
    filas: [
      {
        href: "/config/calendario",
        label: "Calendario externo",
        description: "Suscribir los eventos en tu celular",
        icon: CalendarDays,
      },
      {
        href: "/config/telegram",
        label: "Telegram",
        description: "Recordatorios y vencimientos por chat",
        icon: Send,
      },
    ],
  },
];

export default async function ConfigPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Configuración" description={context.family.name} />

      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} className="flex flex-col gap-2">
          <SectionTitle>{grupo.titulo}</SectionTitle>
          {grupo.descripcion && (
            <p className="px-1 text-xs text-muted-foreground">{grupo.descripcion}</p>
          )}
          <NavGroup>
            {grupo.filas.map((fila) => (
              <NavRow key={fila.href} {...fila} />
            ))}
          </NavGroup>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <SectionTitle>Sesión</SectionTitle>
        <NavGroup>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <UserRound className="size-4 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {context.member.display_name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {context.member.email ?? "Sin email"}
              </span>
            </span>
          </div>
        </NavGroup>
        <form action={logout}>
          <Button type="submit" variant="outline" className="w-full gap-2 text-destructive">
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </form>
      </section>
    </div>
  );
}
