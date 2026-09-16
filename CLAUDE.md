# App Familiar

Aplicación web para organizar la vida doméstica de una familia: compras del
supermercado, eventos, tareas del hogar, documentos y consumo de combustible.
Pensada para uso en celular, por adultos de una misma familia.

Este documento orienta a cualquier sesión de trabajo (humana o de Claude
Code) sobre las convenciones del proyecto. Léelo antes de tocar código.

## Estado del proyecto

- **Fase 0 (base) y Fase 1 (compras): implementadas y verificadas en
  producción** (Vercel + Supabase), incluyendo registro, login con
  Google, generación de listas con deduplicación y el modo supermercado
  probado desde celular.
- **Fase 2 (eventos, calendario y notificaciones): implementada y
  verificada en producción, sin puntos pendientes de verificación.**
  Vinculación de Telegram confirmada funcionando de punta a punta
  (código de 6 dígitos → `/vincular` → `telegram_user_id` guardado). El
  feed ICS se confirmó suscribible desde un calendario real y el cron de
  recordatorios se confirmó corriendo en cron-job.org. Cubre: ABM de
  eventos con categorías/participantes/recurrencia simple, vista
  calendario (grilla mensual + agenda) en `/eventos`, cumpleaños
  virtuales derivados de `birth_date`, feed ICS suscribible en
  `/config/calendario`, notificador de Telegram de una vía
  (`/config/telegram` + webhook + cron horario), y el bloque de eventos
  del dashboard "Hoy". **No** incluye: tareas del hogar, documentos,
  combustible, ni el bot conversacional de Telegram (comandos generales,
  sesiones con estado, inline keyboards) — eso sigue siendo diseño sin
  detalle en este repo, igual que antes.
- **Fase 3 (tareas del hogar): implementada y verificada en
  producción.** Migración `008` aplicada a mano desde el SQL Editor —
  `assets`, `task_definitions` y `task_instances` ya existen en la base
  compartida. El cron diario (`GET /api/cron/tareas`, 07:00
  `America/Asuncion`, mismo `CRON_SECRET`) ya está creado en
  cron-job.org. Cubre: ABM de activos (`/tareas/activos`) con ficha e
  historial de mantenimiento, definiciones de tareas con recurrencia y
  las dos anclas de recálculo (`/tareas/definiciones`), pantalla
  `/tareas` con vencidas/semana/próximas, completar (con fecha editable,
  costo y notas) y omitir, bloque de tareas en el dashboard "Hoy", y el
  cron diario en sí (genera instancias y avisa por Telegram agrupado por
  destinatario). Ver la sección "Fase 3" más abajo para las decisiones
  de diseño. **No** incluye: documentos, combustible, ni la tabla
  `vehicles` (queda para la Fase 4 — ver la nota sobre
  `assets.asset_type = 'vehiculo'` en esa sección).
- **Fase 4 (combustible): implementada y verificada en producción.**
  Migración `009` aplicada a mano desde el SQL Editor — `vehicles` y
  `fuel_logs` ya existen en la base compartida. Cubre: ABM de vehículos
  (`/combustible/vehiculos`) vinculables a un `asset` de tipo `vehiculo`
  (existente o creado en el mismo formulario), carga rápida optimizada
  para la estación (`/combustible/nueva`), cálculo de rendimiento entre
  tanques llenos con manejo de cargas olvidadas
  (`lib/fuel/consumption.ts`), alerta de consumo excesivo al guardar, y
  pantalla de detalle por vehículo (`/combustible/[vehicleId]`) con
  estadísticas, dos gráficos SVG a mano, historial editable/borrable y
  las tareas de mantenimiento pendientes del activo vinculado. También
  incluye tres ajustes post-verificación pedidos por el usuario: botón
  de volver global (ver "UI e internacionalización"), botones "Cargar
  combustible" con preselección de vehículo vía `?vehicle=<id>`, y el
  link cruzado desde la ficha de un activo tipo `vehiculo` hacia
  `/combustible/[vehicleId]`. Ver la sección "Fase 4" más abajo para las
  decisiones de diseño. **No** incluye: documentos, bot conversacional
  de Telegram, ni mantenimiento por kilometraje (el service del auto
  sigue siendo una tarea normal de la Fase 3, con recurrencia temporal —
  no se agregaron columnas a `task_definitions`).
- Migraciones `001` a `009` aplicadas en la base compartida. Antes de escribir la migración `010`, mirá
  `supabase/migrations/` para confirmar el próximo número — no lo
  asumas.
- **Próximo hito: Fase 5 (documentos).** Este repo **no tiene el detalle
  de esa fase**. Si arrancás una sesión para documentos sin que el
  usuario haya pegado el spec correspondiente en el prompt, pedíselo
  antes de crear tablas, rutas o componentes — no los inventes a partir
  del nombre del módulo. "Documentos" hoy solo aparece listado (sin
  ruta) en `/mas`. `hogar.assets.document_id` ya existe pensando en esa
  fase (comentario "la FK recién en Fase 5" en la migración `008`).
- **Lecciones de la puesta en producción** (relevantes para cualquier
  módulo nuevo, no solo compras): ver la regla 10 de la sección
  siguiente sobre grants de tabla para `authenticated`, la regla 12
  sobre el mismo problema pero para `service_role`, y la nota de la
  regla 7 sobre `ensure_family_membership`. Las tres costaron rondas
  reales de debugging con logs de Vercel — no son hipotéticas.

## Stack

- Next.js 15, App Router, TypeScript
- Tailwind CSS v4 + shadcn/ui (estilo "new-york", base color "neutral")
- Supabase (Postgres + Auth), cliente JS v2 vía `@supabase/ssr`
- Zod para validación
- date-fns / date-fns-tz con zona horaria `America/Asuncion`
- Deploy en Vercel

Restricciones deliberadas — no las repliques ni las "mejores":

- **Sin ORM.** Todas las consultas son directas con el cliente de Supabase.
- Server Components por defecto. Client Components (`"use client"`) solo
  donde hace falta interactividad real (formularios, drag & drop, modo
  supermercado, realtime).
- Mutaciones vía **Server Actions**, no rutas API — excepto webhooks,
  crons y el callback de OAuth, que por protocolo/naturaleza tienen que
  ser Route Handlers: `app/auth/callback/route.ts` (GET, OAuth),
  `app/api/calendar/[token]/route.ts` (GET, feed ICS sin sesión),
  `app/api/telegram/webhook/route.ts` (POST, lo llama Telegram),
  `app/api/cron/recordatorios/route.ts` (GET, lo llama cron-job.org) y
  `app/api/cron/tareas/route.ts` (GET, lo llama cron-job.org, Fase 3).
- Sin librerías de estado global (Redux, Zustand). Alcanza con Server
  Components + estado local de React.
- Sin tests automatizados en esta etapa.
- Sin caché offline ni sincronización en background (el service worker
  solo hace la PWA instalable).

## UI e internacionalización

- Toda la interfaz está en **español** (es-PY informal, "vos").
- **Botón de volver global** (`components/app-shell/back-button.tsx`,
  montado en `AppHeader`): usa `router.back()` y se oculta a sí mismo en
  las 5 pantallas del tab bar (`/`, `/compras`, `/eventos`, `/tareas`,
  `/mas`), porque esas son destinos de navegación primaria, no pantallas
  a las que se "entra". En cualquier otra ruta (formularios, detalles,
  ABMs) aparece solo. Agregado a pedido del usuario porque forzaba a
  salir por el tab bar para retroceder un paso. No lo dupliques por
  pantalla — es un único componente en el header, no algo que cada
  página tenga que declarar.
- Moneda: **guaraníes (PYG)**, siempre **sin decimales**. Formatear con
  `Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 })`
  o equivalente — ver `lib/format.ts`.
- Fechas y horas en zona `America/Asuncion` (`lib/dates.ts`).
- **Eventos `all_day` (Fase 2):** se guardan como la medianoche local de
  Asunción de ese día (`dateOnlyToFamilyMidnightUtc` en `lib/dates.ts`),
  y siempre se formatean con esa misma zona. Paraguay está fijo en
  UTC−3 (sin horario de verano), así que ese atajo es seguro acá. Nunca
  uses `new Date(...)` del navegador para derivar la fecha de un evento
  de día completo — toma la zona del dispositivo, no la de la familia.
  Por el mismo motivo, la navegación de la grilla del calendario
  (`month-grid.tsx`) hace aritmética de fecha calendario a mano
  (`addDaysToDateOnly`, `addMonthsToDateOnly`, etc., también en
  `lib/dates.ts`) en vez de usar los helpers locales de `date-fns`, que
  dependen de la zona horaria del navegador.

## Base de datos — reglas críticas

El proyecto de Supabase está **compartido con otras tres aplicaciones**.
Estas reglas no son opcionales:

1. **Todo el esquema vive en `hogar`**, nunca en `public`. El schema ya
   está creado y expuesto en la API de Supabase.
2. El cliente de Supabase se instancia siempre con
   `{ db: { schema: 'hogar' } }` (ver `lib/supabase/*.ts`).
3. **Nunca ejecutes comandos de Supabase CLI contra la base remota**:
   nada de `supabase db push`, `supabase db reset`, `supabase db pull`,
   ni ninguno que modifique la base compartida. Las migraciones se
   escriben como archivos `.sql` numerados en `supabase/migrations/` y el
   dueño del proyecto las aplica a mano desde el SQL Editor. Al agregar
   una migración nueva, avisale al usuario que tiene que aplicarla antes
   de seguir con el código que depende de ella.
4. Todo el SQL debe calificar los objetos con el schema
   (`hogar.tabla`, `hogar.funcion()`), nunca depender de `search_path`
   (excepto dentro de funciones `security definer` que ya fijan
   `search_path = hogar` explícitamente).
5. **RLS obligatorio en todas las tablas**, sin excepción. Patrón estándar
   de cuatro políticas por tabla (select/insert/update/delete), todas con
   la misma condición `family_id = hogar.current_family_id()`. No agregues
   lógica de roles en las políticas: en este MVP todo adulto autenticado
   ve todo lo de su familia.
6. Las funciones helper `hogar.current_family_id()` y
   `hogar.current_member_id()` son `security definer` a propósito, para
   evitar recursión infinita en las políticas de `family_members`. No las
   simplifiques ni las vuelvas `security invoker`.
7. El trigger `hogar.handle_new_user()` sobre `auth.users` es crítico: si
   el email ya existe como miembro sin `user_id`, lo vincula; si no, crea
   una familia nueva. Sin esto, un segundo adulto que se registra termina
   con su propia familia vacía en lugar de sumarse a la existente. No lo
   toques sin motivo.

   El trigger solo cubre altas realmente nuevas en `auth.users`
   (`AFTER INSERT`). Como esa tabla es compartida con las otras 3 apps del
   proyecto, alguien que ya tenía cuenta en otra app (mismo email o misma
   cuenta de Google) nunca dispara el trigger al entrar por primera vez a
   app-familiar. Por eso existe también `hogar.ensure_family_membership()`
   (migración 003): misma lógica de vinculación, pero idempotente y
   basada en `auth.uid()`, pensada para llamarse por RPC en cada login
   exitoso (ver `login()` y `signup()` en `app/(auth)/actions.ts`, y
   `app/auth/callback/route.ts`). No quites esas llamadas a
   `ensure_family_membership` de los flujos de login/callback: sin ellas,
   un usuario que ya usa otra app queda sin familia en app-familiar.

   **Cualquier función nueva pensada para llamarse vía `supabase.rpc(...)`**
   (a diferencia de una función usada solo dentro de una política RLS o
   un trigger) necesita privilegios explícitos además de existir: sin
   `grant execute on function hogar.mi_funcion() to authenticated;` (y
   `grant usage on schema hogar to authenticated;` si es la primera vez),
   PostgREST devuelve `permission denied for schema hogar` (42501). Ver
   `supabase/migrations/004_grants_funciones.sql`, que además deja un
   `alter default privileges` para que las funciones futuras no repitan
   este problema — pero si creás una función y la extraés a un schema u
   objeto distinto, revisá igual que tenga los grants que necesita.
8. `name` y `category_name` en `shopping_list_items` son una copia
   (snapshot) de los datos de la plantilla al momento de crear la lista,
   no un join. Las listas de compras son historial: si una plantilla
   cambia después, las listas viejas no deben cambiar. No lo optimices
   reemplazándolo por un join a `template_items` / `product_categories`.
9. `unit_price` existe en el modelo pero **no se expone en ninguna
   pantalla** (ver Fase 1 más abajo). Es para uso futuro.
10. RLS no alcanza por sí sola: Postgres exige que el rol tenga el
    privilegio de tabla (`GRANT SELECT/INSERT/UPDATE/DELETE`) antes de
    evaluar las políticas. La migración 005 le da esos privilegios a
    `authenticated` sobre todas las tablas de `hogar` que existían en
    ese momento, con un `ALTER DEFAULT PRIVILEGES` que cubre las tablas
    nuevas de fases futuras automáticamente. Aun así, si algún día una
    consulta autenticada nueva falla con
    `permission denied for table X` (42501), es este mismo problema —
    revisá que la tabla en cuestión efectivamente haya heredado el
    default privilege (por ejemplo, si se crea con un rol dueño distinto
    al que corrió la 005).
11. `hogar.reminder_deliveries` (Fase 2) no tiene `family_id` ni grants a
    `authenticated` — a propósito. Solo la toca el cron de recordatorios
    con el admin client (service role), que ignora tanto RLS como los
    grants de rol. Su primary key compuesta
    (`reminder_id, occurrence_starts_at, member_id`) es lo que hace
    idempotente el envío: un recordatorio sobre un evento recurrente
    tiene que dispararse una vez por ocurrencia, no una sola vez para
    siempre — un `sent_at` único en `event_reminders` lo marcaría como
    "enviado" después de la primera ocurrencia y nunca volvería a avisar
    las siguientes. Si dos corridas del cron se solapan, el insert de la
    segunda choca contra la primary key y no se duplica el mensaje, sin
    necesidad de un lock explícito.
12. **`service_role` necesita sus propios grants, igual que
    `authenticated`.** Las migraciones 004 y 005 le dieron privilegios a
    `authenticated`, pero nunca a `service_role` — y bypassear RLS (lo
    que sí hace `service_role` por defecto) es un mecanismo
    completamente independiente de tener el privilegio de schema/tabla
    en sí. Como el admin client (`lib/supabase/admin.ts`) recién se usó
    de verdad por primera vez con la Fase 2 (feed ICS, webhook de
    Telegram, cron de recordatorios), este agujero pasó desapercibido
    desde la Fase 0. Si una consulta con el admin client falla con
    `permission denied for schema hogar` (42501), es este mismo
    problema — ver `supabase/migrations/007_grants_service_role.sql`.
    Cualquier tabla/función nueva que se cree de acá en adelante ya
    queda cubierta por el `ALTER DEFAULT PRIVILEGES` de esa migración,
    pero si en el futuro aparece un cuarto rol de Postgres usado desde
    código (más allá de `anon`/`authenticated`/`service_role`), hay que
    repetir este mismo grant para ese rol — no es automático.

### Migraciones (referencia rápida)

`001` a `009` corridas a mano en Supabase y confirmadas funcionando en
producción.

| Archivo | Contenido |
| --- | --- |
| `001_nucleo.sql` | `families`, `family_members`, funciones helper, trigger de alta, RLS. |
| `002_compras.sql` | Tablas de compras (categorías, plantillas, listas, items) + RLS + realtime. |
| `003_ensure_family_membership.sql` | Vinculación idempotente por RPC (ver regla 7). |
| `004_grants_funciones.sql` | `GRANT EXECUTE` para funciones llamadas por RPC (ver regla 7). |
| `005_grants_tablas.sql` | `GRANT SELECT/INSERT/UPDATE/DELETE` base sobre tablas (ver regla 10). |
| `006_eventos.sql` | `events`, `event_participants`, `event_reminders`, `telegram_link_codes`, `reminder_deliveries` + RLS + grants (ver regla 11). |
| `007_grants_service_role.sql` | `GRANT` de schema/tablas/funciones/secuencias a `service_role` (ver regla 12). |
| `008_tareas.sql` | `assets`, `task_definitions`, `task_instances` + RLS + grants (ver sección Fase 3 más abajo). |
| `009_combustible.sql` | `vehicles`, `fuel_logs` + RLS + grants (ver sección Fase 4 más abajo). |

La próxima migración de cualquier fase nueva es `010_*.sql`. Confirmá el
número real mirando la carpeta antes de crearla, por si esto queda
desactualizado.

## Variables de entorno

Las variables de entorno se cargan **solo en Vercel** — no hay
`.env.local` en este proyecto ni se debe crear uno con valores reales.
En tiempo de ejecución deben existir:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo server, nunca en código de cliente)
- `NEXT_PUBLIC_APP_URL` (Fase 2) — para armar el link del feed ICS en
  `/config/calendario`. Es la única de las nuevas que es pública a
  propósito.
- `TELEGRAM_BOT_TOKEN` (Fase 2, solo server) — token del bot, de
  `@BotFather`.
- `TELEGRAM_WEBHOOK_SECRET` (Fase 2, solo server) — se compara contra el
  header `X-Telegram-Bot-Api-Secret-Token` en
  `app/api/telegram/webhook/route.ts`.
- `CRON_SECRET` (Fase 2, solo server) — protege
  `GET /api/cron/recordatorios` (`Authorization: Bearer <CRON_SECRET>`).

`lib/env.ts` valida su presencia con un mensaje de error claro si falta
alguna. No agregues variables nuevas sin documentarlas ahí y en el README.

## Clientes de Supabase

Tres clientes separados, no los mezcles:

- `lib/supabase/client.ts` — browser (Client Components), usa la anon key.
- `lib/supabase/server.ts` — Server Components y Server Actions, maneja
  cookies vía `@supabase/ssr`, usa la anon key.
- `lib/supabase/admin.ts` — service role key. Solo se importa desde código
  de servidor (Server Actions, route handlers). **Nunca** desde un
  componente cliente.

  El feed ICS (`lib/calendar-feed.ts`) es el primer lugar del proyecto
  donde el admin client se usa porque **no hay sesión posible**, no por
  conveniencia: Apple/Google piden la URL sin cookies, así que
  `hogar.current_family_id()` devolvería `null` y RLS no dejaría ver
  nada. Ahí el filtrado por `family_id` es responsabilidad explícita del
  código (cada query filtra `.eq("family_id", familyId)` a mano) — es el
  único punto del proyecto donde una fuga de `family_id` significa que
  una familia ve los eventos de otra. El webhook de Telegram y el cron
  de recordatorios usan el admin client por el mismo motivo (sin
  sesión), pero ahí no hay riesgo de fuga entre familias porque operan
  sobre filas ya resueltas por id.

## Estructura de rutas

- `(auth)` — `/login`, `/registro`, `/recuperar`. Sin sesión. Ambas
  pantallas ofrecen email/password y "Continuar con Google" (OAuth) como
  métodos alternativos, no excluyentes.
- `/auth/callback` — Route Handler que recibe el `code` del redirect de
  Google y llama `exchangeCodeForSession`. No requiere sesión (el
  middleware lo deja pasar explícitamente). Fuera de los grupos `(auth)`
  y `(app)` a propósito.
- `(app)` — todo lo que requiere sesión. El middleware (`middleware.ts`)
  redirige a `/login` si no hay usuario autenticado.
  - `/` — dashboard "Hoy" (incluye el bloque de eventos de hoy/mañana)
  - `/compras`, `/compras/nueva`, `/compras/[id]`, `/compras/[id]/comprar`,
    `/compras/plantillas`, `/compras/plantillas/[id]`
  - `/eventos` — calendario (grilla mensual + agenda), Fase 2.
  - `/config/familia`, `/config/miembros`, `/config/categorias`
  - `/config/calendario` — link del feed ICS + rotar token, Fase 2.
  - `/config/telegram` — vinculación de cuenta de Telegram, Fase 2.
  - `/tareas` — vencidas/semana/próximas, completar y omitir, Fase 3.
  - `/tareas/definiciones`, `/tareas/definiciones/[id]` — ABM de
    definiciones de tareas + historial, Fase 3.
  - `/tareas/activos`, `/tareas/activos/[id]` — ABM de activos del hogar
    (electrodomésticos, instalaciones, vehículos) + historial de
    mantenimiento, Fase 3. También enlazado desde `/mas`.
  - `/combustible` — listado de vehículos con último rendimiento,
    promedio, costo por km y última carga, Fase 4.
  - `/combustible/nueva` — carga rápida de combustible, Fase 4.
  - `/combustible/vehiculos` — ABM de vehículos, Fase 4.
  - `/combustible/[vehicleId]` — detalle: estadísticas, gráficos,
    historial editable/borrable y tareas de mantenimiento del activo
    vinculado, Fase 4. También enlazado desde `/mas`.
  - `/mas` lista, sin ruta todavía, "Documentos".
- Rutas públicas sin sesión, **fuera** de `(auth)` y `(app)` a propósito
  (ver la lista comentada en `middleware.ts`, y no tocarla sin motivo —
  es el tipo de cosa que se rompe en silencio si alguien toca el
  matcher meses después):
  - `/auth/callback` — Route Handler GET, código de OAuth de Google.
  - `/api/calendar/*` — el feed ICS, lo piden Apple Calendar y Google
    Calendar directo, sin cookies.
  - `/api/telegram/*` — el webhook, lo llama Telegram.
  - `/api/cron/*` — el cron de recordatorios, lo llama cron-job.org.

## Fase 1 — Módulo de compras: decisiones a respetar

1. **Snapshot, no join.** `shopping_list_items.name` /
   `category_name` se copian desde `template_items` al crear la lista.
   Editar una lista (cantidad, borrar, agregar producto suelto) nunca
   toca la plantilla; la única vía para que una plantilla crezca es el
   link explícito "agregar también a una plantilla".
2. **Deduplicación al combinar plantillas**, por nombre normalizado
   (minúsculas, sin tildes, espacios colapsados), tomando la mayor
   `default_quantity` cuando el mismo producto aparece en más de una
   plantilla seleccionada. Ver `lib/normalize.ts`.
3. **`unit_price` no se muestra en ninguna UI**, ni en modo supermercado
   ni en edición de lista. Solo se carga `total_amount` (un campo, al
   cerrar la compra).
4. **Modo supermercado es la pantalla más importante del proyecto.**
   Toda la fila es el área táctil (mínimo 56px de alto), update optimista
   con reversión por toast si falla, agrupado por `sort_order` de
   categoría, wake lock, realtime de Supabase con cuidado de no pisar el
   estado optimista local con el propio eco del cambio. Cero campos de
   texto en esa pantalla. Tiene una flecha para volver a `/compras/[id]`
   sin cerrar la compra (para seguir agregando productos a mitad de
   camino) — no la saques, resolvió un pedido real de uso.
5. **Eliminar una lista** (`deleteShoppingList` en
   `app/(app)/compras/[id]/actions.ts`) está disponible tanto en la
   edición de lista como en el resumen de lista cerrada, con
   confirmación previa. Cubre el caso de una ida al súper que no se
   concretó. El `on delete cascade` de `shopping_list_items.list_id` se
   encarga de los items, no hace falta borrarlos a mano.

## Fase 2 — Eventos, calendario y Telegram: decisiones a respetar

1. **Se guarda la definición de recurrencia, no las instancias.**
   `events.recurrence` (`weekly`/`monthly`/`yearly`) +
   `recurrence_until` opcional. La expansión a ocurrencias concretas
   sobre un rango vive en un solo lugar, `lib/recurrence.ts`
   (`expandOccurrences`), y la usan la grilla, la agenda, el dashboard y
   el cron de recordatorios. No dupliques esa lógica en ninguno de esos
   lugares. No implementa excepciones a series ni RRULE completo.
2. **Los cumpleaños no son eventos.** Se derivan en memoria de
   `family_members.birth_date` (`lib/events/birthdays.ts`,
   `expandBirthdays`), de solo lectura, categoría `cumpleanos`. No
   confundas esto con crear filas en `events` — nunca se materializan.
3. **El feed ICS no expande recurrencia.** A diferencia de la UI, emite
   un solo `VEVENT` por evento (o por miembro con cumpleaños) con su
   `RRULE`, y es el cliente de calendario (Apple/Google) el que expande
   — es el modelo estándar de ICS. Ver `lib/ics.ts`.
4. **`SEQUENCE` del ICS se deriva de `updated_at`** (epoch en segundos),
   no hay una columna dedicada. Es estrictamente creciente cada vez que
   el trigger `events_set_updated_at` toca la fila, que es lo único que
   pide RFC 5545 (no hace falta que suba de a 1).
5. **Folding y escapado del ICS son funciones separadas y puras** en
   `lib/ics.ts` (`foldIcsLine`, `escapeIcsText`) — el folding corta por
   bytes UTF-8, no por caracteres, para no partir una tilde o una ñ a la
   mitad a los 75 octetos.
6. **El notificador de Telegram es de una vía.** No agregues comandos
   conversacionales, sesiones con estado ni inline keyboards al webhook
   (`app/api/telegram/webhook/route.ts`) — entiende únicamente `/start`
   y `/vincular <código>`. Eso es una fase futura sin spec en este repo.
7. **La vinculación de Telegram se resuelve contra `member_id`, nunca
   contra email.** `auth.users` es compartida entre las 4 apps del
   proyecto — no asumas nada sobre "usuario nuevo" a partir de esa
   tabla.
8. **El cron nunca manda nada si no hay recordatorios vencidos.** Sin
   resumen diario, sin "no tenés eventos hoy" — el bot solo habla cuando
   hay algo concreto que avisar (`app/api/cron/recordatorios/route.ts`).
   Ventana de reenvío: recordatorios cuyo aviso caiga entre "ahora" y
   "ahora − 3 horas", para no generar una avalancha de avisos viejos
   tras una caída del cron. Por qué `reminder_deliveries` (y no un
   `sent_at`) hace esto idempotente: ver regla 11 de la sección de base
   de datos.

## Fase 3 — Tareas del hogar: decisiones a respetar

1. **Las tareas de mantenimiento NO recurren como los eventos.** Un
   evento recurre contra el calendario (la clase de natación es todos
   los martes, se haya ido o no) y `lib/recurrence.ts` la expande en
   memoria sin materializar nada. Una tarea de mantenimiento recurre
   contra el último cumplimiento real: "limpiar el filtro cada 3 meses"
   significa 3 meses desde que se limpió de verdad, no desde la fecha
   teórica anterior. Por eso las tareas **sí se materializan** (una fila
   por vencimiento, en `task_instances`) y la lógica vive aparte, en
   `lib/tasks/schedule.ts`, con funciones puras. No unifiques los dos
   módulos — parecen lo mismo y no lo son. No toques `lib/recurrence.ts`
   ni `lib/ics.ts` por este módulo.
2. **`recurrence_anchor` decide contra qué se recalcula.** `completion`
   (default) recalcula desde la fecha real de completado — limpieza,
   mantenimiento. `schedule` recalcula desde el vencimiento teórico
   anterior — impuestos, seguros, renovaciones con fecha fija. **Omitir
   una tarea siempre recalcula con ancla `schedule`**, sin importar el
   ancla de la definición: saltearse la limpieza del filtro no debe
   correr el próximo vencimiento 3 meses a partir de hoy como si se
   hubiera hecho.
3. **Ancla `schedule` muy atrasada: catch-up en `advanceUntilFuture`.**
   Si el vencimiento teórico + intervalo sigue en el pasado, se sigue
   sumando intervalos hasta superar hoy — si no, una tarea de fecha fija
   muy atrasada generaría instancias vencidas en cadena para siempre.
4. **Una definición activa tiene como máximo una instancia `pendiente` a
   la vez** (`shouldGenerateInstance` en `lib/tasks/schedule.ts`). Sin
   esta regla, una tarea ignorada 6 meses generaría decenas de filas.
5. **`unique(definition_id, due_date)` en `task_instances`** es la
   idempotencia del generador — mismo principio que
   `reminder_deliveries` en la Fase 2, pero aplicado a la tabla que ya
   existía de todos modos, sin tabla extra.
6. **`due_date` es `date`, no `timestamptz`.** Una tarea vence un día,
   no a una hora — evita a propósito el problema de zona horaria que
   hubo que resolver para eventos `all_day` (regla de UI más arriba). No
   lo conviertas a timestamp "para unificar" con eventos.
7. **`warranty_notified_at` en `assets` no estaba en el diseño original
   del prompt de la Fase 3** — se agregó porque el aviso de garantía
   próxima a vencer necesita el mismo mecanismo de idempotencia
   (notified_at + reenvío cada 7 días) que las tareas, o el cron
   mandaría ese aviso todos los días mientras la garantía esté vigente.
   Ver `lib/tasks/schedule.ts` (`shouldNotifyWarranty`,
   `WARRANTY_LEAD_DAYS`).
8. **`assets.asset_type` incluye `'vehiculo'` a propósito, pensando en
   la Fase 4 (combustible).** Esa fase futura va a crear una tabla
   `vehicles` con un `asset_id` opcional apuntando acá, para que el auto
   no exista dos veces en la base — el service del auto es una tarea de
   mantenimiento vía `task_definitions`, la carga de nafta es otra cosa,
   pero el auto es uno solo. No crear `vehicles` fuera de esa fase.
9. **El cron de tareas (`app/api/cron/tareas/route.ts`) corre una vez
   por día** (a diferencia del cron de eventos, que es horario), en dos
   pasos: generar instancias y avisar. Reutiliza
   `sendTelegramMessage`/`escapeTelegramHtml` de `lib/telegram.ts` — no
   se agregó nada nuevo de Telegram.
10. **Un solo mensaje de Telegram por destinatario**, agrupando todas
    sus tareas por avisar (vencidas primero, con días de atraso) y las
    garantías próximas a vencer — a diferencia del cron de eventos, que
    manda un mensaje por ocurrencia. Se mantiene la regla de la Fase 2:
    si no hay nada que avisar, no se manda nada a nadie.
11. **Un aviso se repite cada 7 días mientras la tarea siga pendiente**,
    no todos los días — controlado por `notified_at` en `task_instances`
    (y `warranty_notified_at` en `assets`), no por un booleano.
12. **"Marcar hecha" desde `/tareas` es optimista con deshacer.** El
    servidor devuelve el `next_due_date`/`is_active` previos de la
    definición (`CompleteResult.undo` en `app/(app)/tareas/actions.ts`)
    para poder revertir tanto la instancia como la definición desde el
    toast de "Deshacer" sin volver a consultar la base.

## Fase 4 — Combustible: decisiones a respetar

1. **El rendimiento SOLO se calcula entre tanques llenos.** Una carga
   suelta no dice nada: no se sabe cuánto combustible había en el tanque
   antes ni cuánto quedó después. `fuel_logs.is_full_tank` no es un
   campo de conveniencia, sostiene todo el módulo — ver
   `lib/fuel/consumption.ts` (`computeFuelIntervals`).
2. **`resets_calculation` existe por la carga olvidada.** Si alguien
   carga nafta y no lo registra, el intervalo siguiente suma kilómetros
   recorridos con litros que no están en la base, y el rendimiento
   resultante queda absurdamente alto (contaminando el promedio y
   volviendo inútil la alerta de consumo excesivo). El sistema no puede
   detectar esto solo — por eso hay un toggle explícito, en lenguaje
   humano en la UI ("me olvidé de registrar una carga anterior", nunca
   el nombre técnico), que corta el intervalo que termina en esa carga
   sin perder el punto de partida del siguiente.
3. **La cadena se ordena por odómetro, no por `filled_at`.** Insertar
   retroactivamente una carga olvidada la ubica sola en su lugar
   correcto de la secuencia y repara los intervalos afectados, aunque su
   fecha de creación sea posterior. Ordenar por fecha daría una cadena
   inconsistente. Ver la nota de la migración `009` sobre por qué el
   índice de `fuel_logs` es `(vehicle_id, odometer)`.
4. **`unique(vehicle_id, odometer)` protege contra el doble submit** en
   la estación con mala señal — dos cargas al mismo kilometraje son
   físicamente imposibles, así que la restricción nunca molesta a nadie
   en un uso legítimo.
5. **El cálculo vive en `lib/fuel/consumption.ts` (TypeScript), no en una
   vista SQL.** Una vista sobre tablas con RLS no hereda las políticas —
   corre con los privilegios de su dueño salvo `WITH (security_invoker =
   true)` — y olvidarlo filtraría datos entre familias, la misma clase
   de problema que ya costó las migraciones 004, 005 y 007. El volumen
   es chico (unas cientos de filas por vehículo en toda su vida útil),
   así que no hay ninguna ventaja de rendimiento en resolverlo en la
   base. Si en algún momento hiciera falta una vista, solo con
   `security_invoker = true`.
6. **La alerta de consumo excesivo se muestra una sola vez, al guardar
   la carga** (`/combustible/nueva`), comparando el rendimiento del
   último intervalo contra el promedio de hasta los cinco anteriores
   (`checkConsumptionDrop`). No hay cron ni aviso por Telegram para
   esto — la persona está parada en la estación con el celular en la
   mano, que es el mejor momento posible para decírselo.
7. **El mantenimiento por kilometraje quedó deliberadamente fuera de
   alcance.** El service del auto se carga como una tarea normal de la
   Fase 3 vía `task_definitions`, con recurrencia temporal (`recurrence_
   every`/`recurrence_unit`) — no se agregaron columnas a
   `task_definitions` para esto, ni se tocó `lib/tasks/schedule.ts`. La
   carga de nafta y el mantenimiento del vehículo son datos separados
   que comparten el mismo `asset_id` de `hogar.assets`
   (`asset_type = 'vehiculo'`) para que el auto no exista dos veces en
   la base — ver `lib/fuel/queries.ts`
   (`listPendingTaskDefinitionsForAsset`).
8. **Los gráficos de rendimiento y precio por litro son SVG a mano, sin
   librería** (`app/(app)/combustible/[vehicleId]/performance-chart.tsx`
   y `price-chart.tsx`) — mismo criterio que el calendario (Fase 2) y el
   modo supermercado (Fase 1): son dos series simples y una librería de
   charts traería su propio sistema de estilos a pelear con Tailwind v4.
9. **Editar una carga vieja no repite las advertencias de
   `/combustible/nueva`.** `updateFuelLog`
   (`app/(app)/combustible/[vehicleId]/actions.ts`) solo valida lo
   bloqueante (litros > 0, odómetro único) — quien edita ya está
   corrigiendo un dato a propósito, no cargando parada en la estación.
   Las métricas derivadas se recalculan solas en la próxima lectura,
   porque no hay nada precalculado que actualizar.
10. **El dashboard "Hoy" tiene un acceso directo a "Cargar combustible"
    (botón, sin datos), pedido explícitamente por el usuario después de
    la implementación inicial** — a diferencia de eventos/tareas/compras,
    no es un bloque con datos pendientes: cargar nafta no vence ni se
    programa, así que no hay nada que listar ahí. Si se te ocurre
    "completarlo" con datos (último rendimiento, próxima carga
    estimada), pensalo dos veces — el criterio original de este módulo
    fue justamente no meter ruido de combustible en el dashboard.
11. **`/combustible/nueva` acepta `?vehicle=<id>`** para preseleccionar
    el vehículo (usado por los botones "Cargar combustible" que aparecen
    en cada tarjeta de `/combustible` cuando hay más de un vehículo, y
    en el propio detalle de `/combustible/[vehicleId]`) — sin el query
    param, sigue priorizando el último vehículo usado por esa persona.
    El selector de vehículo en el formulario (visible solo si hay más de
    uno) sigue siendo editable igual; el query param solo cambia el
    valor por defecto.
12. **La ficha de un activo de tipo `vehiculo` (`/tareas/activos/[id]`)
    linkea al vehículo vinculado en `/combustible/[vehicleId]`** (o a
    `/combustible/vehiculos` si todavía no tiene uno vinculado), vía
    `getVehicleByAssetId` en `lib/fuel/queries.ts`. Es el sentido
    inverso de `listPendingTaskDefinitionsForAsset`: los datos propios
    del vehículo (odómetro inicial, tanque, tipo de combustible) viven
    en `vehicles`, no en `assets`, y sin este link la persona no tiene
    forma de adivinar dónde están desde la pantalla de mantenimiento.

## Comandos útiles

```bash
npm run dev       # servidor de desarrollo
npm run build     # build de producción — debe pasar sin errores de TS
npm run lint
```

No ejecutes `vercel` ni ningún comando del CLI de Vercel: el proyecto se
vincula desde el dashboard. No ejecutes comandos del Supabase CLI contra
la base remota (ver arriba).
