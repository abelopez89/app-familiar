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
- **Fase 2 (eventos, calendario y notificaciones): implementada**, sujeta
  a que el usuario haya aplicado la migración `006` y cargado las
  variables de entorno nuevas (ver más abajo) y los pasos manuales del
  lado de Telegram (webhook registrado, cron configurado en
  cron-job.org). Cubre: ABM de eventos con categorías/participantes/
  recurrencia simple, vista calendario (grilla mensual + agenda) en
  `/eventos`, cumpleaños virtuales derivados de `birth_date`, feed ICS
  suscribible en `/config/calendario`, notificador de Telegram de una
  vía (`/config/telegram` + webhook + cron horario), y el bloque de
  eventos del dashboard "Hoy". **No** incluye: tareas del hogar,
  documentos, combustible, ni el bot conversacional de Telegram
  (comandos generales, sesiones con estado, inline keyboards) — eso
  sigue siendo diseño sin detalle en este repo, igual que antes.
- Migraciones `001` a `006` aplicadas en la base compartida. Antes de
  escribir la migración `007`, mirá `supabase/migrations/` para confirmar
  el próximo número — no lo asumas.
- **Próximo hito: Fase 3 (tareas del hogar).** Documentos y combustible
  siguen mencionados en el diseño original pero **este repo no tiene el
  detalle de esas fases**. Si arrancás una sesión para alguna de ellas
  sin que el usuario haya pegado el spec correspondiente en el prompt,
  pedíselo antes de crear tablas, rutas o componentes — no los inventes
  a partir del nombre del módulo. El bottom nav ya tiene un placeholder
  "Próximamente" para `/tareas`; "Documentos" y "Combustible" hoy solo
  aparecen listados (sin ruta) en `/mas`.
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
  `app/api/telegram/webhook/route.ts` (POST, lo llama Telegram) y
  `app/api/cron/recordatorios/route.ts` (GET, lo llama cron-job.org).
- Sin librerías de estado global (Redux, Zustand). Alcanza con Server
  Components + estado local de React.
- Sin tests automatizados en esta etapa.
- Sin caché offline ni sincronización en background (el service worker
  solo hace la PWA instalable).

## UI e internacionalización

- Toda la interfaz está en **español** (es-PY informal, "vos").
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

### Migraciones aplicadas (referencia rápida)

Todas corridas a mano en Supabase y confirmadas funcionando en producción:

| Archivo | Contenido |
| --- | --- |
| `001_nucleo.sql` | `families`, `family_members`, funciones helper, trigger de alta, RLS. |
| `002_compras.sql` | Tablas de compras (categorías, plantillas, listas, items) + RLS + realtime. |
| `003_ensure_family_membership.sql` | Vinculación idempotente por RPC (ver regla 7). |
| `004_grants_funciones.sql` | `GRANT EXECUTE` para funciones llamadas por RPC (ver regla 7). |
| `005_grants_tablas.sql` | `GRANT SELECT/INSERT/UPDATE/DELETE` base sobre tablas (ver regla 10). |
| `006_eventos.sql` | `events`, `event_participants`, `event_reminders`, `telegram_link_codes`, `reminder_deliveries` + RLS + grants (ver regla 11). |
| `007_grants_service_role.sql` | `GRANT` de schema/tablas/funciones/secuencias a `service_role` (ver regla 12). |

La próxima migración de cualquier fase nueva es `008_*.sql`. Confirmá el
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
  - `/tareas`, `/mas` — `/tareas` sigue siendo placeholder "Próximamente"
    hasta la fase de tareas del hogar; `/mas` lista, sin ruta todavía,
    "Documentos" y "Combustible".
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

## Comandos útiles

```bash
npm run dev       # servidor de desarrollo
npm run build     # build de producción — debe pasar sin errores de TS
npm run lint
```

No ejecutes `vercel` ni ningún comando del CLI de Vercel: el proyecto se
vincula desde el dashboard. No ejecutes comandos del Supabase CLI contra
la base remota (ver arriba).
