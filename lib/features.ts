/**
 * Banderas de módulos (Fase 6).
 *
 * Una constante en el código, no una tabla ni una variable de entorno, a
 * propósito: prender o apagar un módulo es cambiar el valor y desplegar.
 * Una tabla de configuración agregaría migración, pantalla de
 * administración y una consulta en cada render para algo que se toca dos
 * veces en la vida del proyecto.
 *
 * `tareas: false` oculta el acceso del inicio y del tab bar, el bloque
 * del resumen del día, las tareas asignadas en la ficha de miembro, y
 * hace que el cron diario no genere instancias ni avise tareas. No borra
 * nada: tablas, datos y rutas siguen ahí (se entra por URL directa o
 * desde "Módulos desactivados" en `/config`). Como el cron no toca
 * `next_due_date` mientras está apagado, al volver a `true` el generador
 * retoma solo desde donde corresponde, sin pila de vencidas acumuladas.
 */
export const FEATURES = {
  tareas: false,
} as const;
