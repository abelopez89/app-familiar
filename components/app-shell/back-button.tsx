"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Las 5 pantallas del tab bar no llevan botón de volver: son destinos
// de navegación primaria, no pantallas a las que se "entra" desde otra.
// Todo lo demás (formularios, detalles, ABMs) sí, para no obligar a
// salir por el tab bar y volver a entrar cuando se quiere retroceder un
// solo paso.
const ROOT_PATHS = new Set(["/", "/compras", "/eventos", "/tareas", "/mas"]);

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (ROOT_PATHS.has(pathname)) return null;

  return (
    <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Volver">
      <ChevronLeft className="size-5" />
    </Button>
  );
}
