import { permanentRedirect } from "next/navigation";

/**
 * La pestaña "Más" dejó de existir en el rediseño: sus módulos se fueron
 * a la grilla del inicio y sus ajustes a `/config`. Se mantiene la ruta
 * redirigiendo porque la PWA puede tener la URL guardada en el historial
 * o en un acceso directo de la pantalla de inicio del celular.
 */
export default function MasPage() {
  permanentRedirect("/config");
}
