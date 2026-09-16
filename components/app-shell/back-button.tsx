"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ROOT_PATHS } from "./modules";

/**
 * Las 5 pantallas del tab bar no llevan botón de volver: son destinos de
 * navegación primaria, no pantallas a las que se "entra" desde otra.
 * Todo lo demás (formularios, detalles, ABMs) sí, para no obligar a
 * salir por el tab bar y volver a entrar cuando se quiere retroceder un
 * solo paso.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (ROOT_PATHS.has(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Volver"
      className="-ml-1 flex size-10 items-center justify-center rounded-full text-foreground transition-colors active:bg-muted"
    >
      <ChevronLeft className="size-6" strokeWidth={2.25} />
    </button>
  );
}
