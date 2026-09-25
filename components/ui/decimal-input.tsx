"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Campo numérico decimal a prueba de la configuración regional del
 * celular.
 *
 * Un `<input type="number">` en iOS/Android muestra el teclado que pide
 * `inputMode`, pero el propio elemento solo acepta el punto "." como
 * separador decimal — así lo exige el estándar HTML, sin importar el
 * idioma del sistema. Con el celular en es-PY (que usa coma), el
 * teclado numérico le ofrece al usuario una tecla ",", y esa tecla se
 * descarta en silencio: se aprieta la coma y no pasa nada. Eso es
 * exactamente "no me deja poner decimales" — no es un límite a
 * propósito, es este bug conocido de `type="number"` con configuración
 * regional de coma.
 *
 * La solución es no usar `type="number"` para estos campos: se
 * renderiza como texto con `inputMode="decimal"` (mismo teclado
 * numérico del celular) y normaliza cualquier "," que el usuario tipee
 * a "." antes de que el valor llegue a cualquier estado o a FormData —
 * así el resto del formulario (controlado o no) sigue leyendo un
 * número con el separador que esperan `Number(...)` / `z.coerce.number()`
 * en el servidor. Usar en cualquier campo nuevo que acepte decimales
 * (litros, kilometraje, cantidades) — no volver a `type="number"` con
 * `step` fraccionario.
 */
export const DecimalInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(function DecimalInput({ onChange, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      onChange={(e) => {
        const withDot = e.target.value.replace(/,/g, ".");
        const cleaned = withDot.replace(/[^0-9.]/g, "");
        const firstDot = cleaned.indexOf(".");
        const normalized =
          firstDot === -1
            ? cleaned
            : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
        if (normalized !== e.target.value) {
          e.target.value = normalized;
        }
        onChange?.(e);
      }}
      {...props}
    />
  );
});
