/**
 * Banderas de módulos (Fase 6).
 *
 * Una constante en el código, no una tabla ni una variable de entorno, a
 * propósito: prender o apagar un módulo es cambiar el valor y desplegar.
 * Una tabla de configuración agregaría migración, pantalla de
 * administración y una consulta en cada render para algo que se toca dos
 * veces en la vida del proyecto.
 *
 * `tareas` decide si el módulo está a la vista: con `false` se ocultan el
 * acceso del inicio y del tab bar, el bloque del resumen del día, las
 * tareas asignadas en la ficha de miembro y las listas de tareas del
 * vehículo y del activo. El módulo se sigue usando desde `/config`
 * ("Tareas del hogar"). No borra nada: tablas, datos y rutas siguen ahí.
 *
 * `tareasAvisos` decide si el cron diario genera instancias y avisa las
 * tareas por Telegram. Es independiente de `tareas` a pedido del usuario:
 * el módulo puede estar fuera del inicio y seguir avisando. Si algún día
 * se apaga, el cron deja de generar (no solo de avisar) a propósito: como
 * `next_due_date` no se toca, al volver a prenderlo el generador retoma
 * desde donde corresponde, sin una pila de vencidas acumuladas.
 */
export const FEATURES = {
  tareas: false,
  tareasAvisos: true,
} as const;
