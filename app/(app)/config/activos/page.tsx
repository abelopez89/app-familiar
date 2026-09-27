import { redirect } from "next/navigation";

/**
 * Los activos del hogar ya no son solo de Tareas: la Fase 4 les vincula
 * vehículos y la Fase 5 permite adjuntarles el manual. Se listan desde
 * `/config` como un catálogo más, pero las rutas siguen viviendo en
 * `/tareas/activos` — no se movieron para no tocar código que funciona.
 */
export default function ConfigActivosPage() {
  redirect("/tareas/activos");
}
