import Link from "next/link";
import { CalendarDays, ChevronRight, FileText, Fuel, LogOut, Send, Settings, Users, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";

const configLinks = [
  { href: "/config/familia", label: "Familia", icon: Settings },
  { href: "/config/miembros", label: "Miembros", icon: Users },
  { href: "/config/categorias", label: "Categorías de productos", icon: Settings },
  { href: "/config/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/config/telegram", label: "Telegram", icon: Send },
  { href: "/tareas/activos", label: "Activos", icon: Wrench },
  { href: "/combustible", label: "Combustible", icon: Fuel },
];

const proximamente = [{ label: "Documentos", icon: FileText }];

export default function MasPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {configLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-4 py-3.5 text-sm"
            >
              <span className="flex items-center gap-3">
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {proximamente.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between px-4 py-3.5 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-3">
                <Icon className="size-4" />
                {label}
              </span>
              <span className="text-xs">Próximamente</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <form action={logout}>
        <Button type="submit" variant="outline" className="w-full gap-2">
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
