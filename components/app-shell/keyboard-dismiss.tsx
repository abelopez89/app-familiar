"use client";

import { useEffect } from "react";

function isTextField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "submit", "reset", "file", "range", "color"].includes(el.type);
}

/**
 * Bug de iOS en la app instalada (pantalla de inicio): si se cambia de
 * pantalla con el teclado abierto, el campo enfocado desaparece del DOM y
 * iOS cierra el teclado sin volver a calcular el alto de la pantalla. Todo
 * lo fijo al pie (tab bar, "Cerrar compra") queda flotando a mitad de
 * pantalla, a la altura donde estaba el borde del teclado. Pasó en
 * producción: agregar productos en `/compras/[id]` y tocar "Ir a comprar".
 *
 * Dos defensas, sin efecto visible fuera de ese caso:
 * 1. Al tocar un link con un campo de texto enfocado, se le saca el foco
 *    antes de navegar, así iOS cierra el teclado por el camino normal.
 * 2. Cuando el teclado se cierra (el alto visible vuelve a crecer), un
 *    `scrollTo` a la misma posición obliga a iOS a reubicar lo fijo.
 */
export function KeyboardDismiss() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target?.closest("a[href]")) return;
      const active = document.activeElement;
      if (isTextField(active)) active.blur();
    }
    document.addEventListener("click", handleClick, true);

    const viewport = window.visualViewport;
    let lastHeight = viewport?.height ?? 0;
    function handleResize() {
      if (!viewport) return;
      const grew = viewport.height > lastHeight + 100;
      lastHeight = viewport.height;
      if (grew) {
        requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY));
      }
    }
    viewport?.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("click", handleClick, true);
      viewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  return null;
}
