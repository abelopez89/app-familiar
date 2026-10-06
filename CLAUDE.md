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
- **Fase 5 (Centro de Documentos): implementada y verificada en
  producción.** Migración `010` aplicada y bucket `documentos` creado;
  el usuario confirmó el módulo probado de punta a punta. Cubre: bucket
  privado `documentos` con políticas propias sobre
  `storage.objects` (aislamiento entre familias resuelto por la base, no
  por el código — ver la sección "Fase 5" más abajo), tablas
  `document_categories`/`documents`/`document_files`, la FK pendiente
  `assets.document_id → documents.id`, compresión de imágenes en el
  cliente (`lib/documents/image.ts`, EXIF vía `createImageBitmap`,
  fallback si el navegador no puede decodificar el archivo), `/documentos`
  (buscador + fijados + filtros por miembro/categoría, sin carpetas),
  `/documentos/nuevo`, `/documentos/[id]` (visor con zoom, navegación
  entre páginas, PDF en pestaña nueva, editar metadatos, agregar/quitar
  páginas), `/config/documentos` (ABM de categorías + espacio usado) y
  `/config/miembros/[id]` (ficha de miembro nueva: documentos agrupados
  por categoría, próximos eventos, tareas asignadas). El cron diario
  (antes "cron de tareas", `/api/cron/tareas`) ahora también avisa
  vencimientos de documentos, con el mismo mecanismo de idempotencia
  (`expiry_notified_at`) que garantías y tareas — no se creó un cron ni
  una ruta nueva. Ver la sección "Fase 5" más abajo para las decisiones
  de diseño. **No** incluye: OCR, versionado de documentos, carpetas, ni
  compartir fuera de la familia — deliberadamente fuera de alcance.
- **Fase Extra (rediseño de interfaz y performance): implementada, sin
  cambios de base de datos ni de lógica de negocio.** Rediseña la app
  como un ecosistema con un sistema de diseño propio (tokens con color
  por módulo y modo oscuro automático), reemplaza el tablero del inicio
  por un lanzador, consolida todos los ajustes en `/config` y elimina la
  pestaña "Más". En el camino corrige el manejo de las áreas seguras del
  iPhone y baja de forma importante el JavaScript inicial de las
  pantallas más usadas. Ver la sección "Fase Extra" más abajo. **No**
  incluye: ninguna migración, ningún cambio en las reglas de negocio de
  las fases anteriores, ni el selector manual de tema claro/oscuro (el
  sistema decide).
- **Fase 6 (Tareas apagado + Gastos compartidos): implementada y
  verificada en producción** (el usuario lo probó desde el celular).
  Migración `011` aplicada a mano desde el SQL Editor. Dos partes:
  (A) el módulo de Tareas queda **apagado** con una bandera en
  `lib/features.ts` (`FEATURES.tareas = false`), sin borrar tablas,
  datos ni rutas; (B) módulo nuevo de **Gastos compartidos** en
  `/gastos`: grupos con participantes (miembros o invitados por grupo),
  gastos en varias monedas con cotización editable, división en tres
  modos con partes materializadas en enteros de guaraníes, balances en
  vivo con el invariante de suma cero, clearing greedy, registro de
  pagos y resumen para compartir. Ocupa el lugar de Tareas en el
  lanzador y en el tab bar. Ver la sección "Fase 6" más abajo. **No**
  incluye: control de gastos personales ni presupuesto, varios
  pagadores por gasto, directorio global de invitados, conversión de
  monedas por API, cron ni avisos de Telegram de gastos.
- **Mejoras post-Fase 6: implementadas y verificadas en producción**
  (el usuario las probó desde el celular), sin migraciones: rendimiento de combustible
  en L/100 km por defecto con selector a km/L; listas de compras sin
  plantilla; "Almacén" como categoría por defecto de un producto nuevo;
  plantillas ordenadas por categoría y nombre; día explícito ("Hoy",
  "Mañana") en los eventos del resumen del inicio; y Tareas vuelve a
  avisar por Telegram (bandera `tareasAvisos`) y se puede crear una
  tarea desde `/tareas`, sin volver al inicio. Ver "Mejoras post-Fase 6"
  más abajo.
- **Fase 7 (bot conversacional de Telegram): implementada, pendiente
  de verificación en producción.** Migraciones `012` (tablas
  `telegram_sessions` y `telegram_updates`) y `013` (`save_expense()`
  usable sin sesión) aplicadas y confirmadas en la base. Cubre: capa de servicios compartida entre
  Server Actions y bot (`lib/services/`), `lib/telegram/` (cliente,
  router, sesiones, teclados, flujos), comandos `/menu`, `/hoy`,
  `/compra`, `/gasto`, `/nafta`, `/cancelar`, botón "Marcar hecha" en el
  aviso diario de tareas y "Ver agenda del día" en los recordatorios de
  eventos, y la limpieza de `telegram_updates` en el cron diario. Ver la
  sección "Fase 7" más abajo. **No** incluye: crear eventos por chat,
  subir documentos por foto, divisiones de gastos por pesos o importes
  exactos por chat, ni chats de grupo.
- Migraciones `001` a `013` aplicadas y confirmadas en la base
  compartida. Antes de escribir la
  migración `014`, mirá `supabase/migrations/` para confirmar el próximo
  número — no lo asumas.
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
  Desde la Fase 7 la lógica de negocio de esas mutaciones vive en
  `lib/services/` (ver "Fase 7"): la Server Action resuelve familia y
  miembro desde la sesión y delega; el bot hace lo mismo desde
  `telegram_user_id`.
- Sin librerías de estado global (Redux, Zustand). Alcanza con Server
  Components + estado local de React.
- Sin tests automatizados en esta etapa.
- Sin caché offline ni sincronización en background (el service worker
  solo hace la PWA instalable).

## UI e internacionalización

- Toda la interfaz está en **español** (es-PY informal, "vos").
- **Sistema de diseño en `app/globals.css`** (Fase Extra). Todo el color
  sale de custom properties; no hay colores de Tailwind escritos a mano
  en las pantallas (`bg-blue-500` y compañía). Los tokens semánticos son
  los de shadcn (`background`, `card`, `primary`, `muted`, `border`…)
  más `success`, `warning` y `surface`, y encima de esos hay **un par de
  tokens por módulo**: `--mod-<modulo>` para el color del ícono y
  `--mod-<modulo>-soft` para el fondo tintado que va detrás. Los siete
  módulos son `compras`, `eventos`, `tareas`, `combustible`,
  `documentos`, `familia` y `gastos` (Fase 6). Si agregás un módulo, agregá su par de
  tokens en los tres bloques de color (`:root`, la media query oscura y
  `.dark`) y su entrada en `MODULES` — no inventes un color suelto en la
  pantalla.
- **Modo oscuro automático por `prefers-color-scheme`**, sin script ni
  flash de tema al abrir la PWA. La variante `dark:` de Tailwind está
  redefinida en `globals.css` con un `@custom-variant` que cubre a la
  vez la media query del sistema y la clase `.dark` (con `.light` como
  anulación), así que los `dark:` que ya traían los componentes de
  shadcn responden solos. Los valores oscuros están escritos **dos
  veces** a propósito (media query + `.dark`): si tocás uno, tocá el
  otro.
- **Áreas seguras del iPhone.** El layout raíz declara
  `viewportFit: "cover"`, y `globals.css` expone `--safe-top`,
  `--safe-bottom` y `--nav-total` (alto del tab bar + inset inferior).
  Cualquier cosa fija al pie se posiciona contra `--nav-total`, nunca
  con un `bottom-16`/`bottom-20` a ojo: usá `FloatingAction` o
  `StickyBottomBar` de `components/app-shell/floating-action.tsx`, y
  `pb-nav` para el contenido. Sin esto, en un iPhone con indicador de
  inicio los botones quedan medio tapados.
- **Componentes compartidos de pantalla**, en vez de que cada página
  arme su propio encabezado: `PageHeader` y `SectionTitle`
  (`components/app-shell/page-header.tsx`), `EmptyState`, `NavRow` /
  `NavGroup`, `Stat` y `ModuleTile`. Una pantalla nueva empieza con
  `PageHeader`, no con un `<h1>` suelto.
- **Blancos táctiles de 44px** en móvil (guías de Apple): los tamaños
  por defecto de `Button`, `Input` y `SelectTrigger` son altos en la
  pantalla chica y vuelven al alto compacto en `sm:` para arriba. La
  utilidad `.tap-target` hace lo mismo para filas propias.
- **Campos numéricos decimales: nunca `<input type="number">`.** Litros,
  kilometraje, cantidades — cualquier campo con `step` fraccionario. En
  iOS/Android con la región en es-PY (coma como separador decimal), el
  teclado numérico le ofrece al usuario una tecla ",", pero ese
  elemento solo acepta "." — la coma se descarta en silencio y el
  usuario no puede escribir el decimal (así se detectó: "no me deja
  poner decimales" en la carga de combustible). Usá `DecimalInput`
  (`components/ui/decimal-input.tsx`): un campo de texto con
  `inputMode="decimal"` que muestra el mismo teclado numérico y
  normaliza cualquier "," tipeada a "." antes de que el valor llegue a
  React o a `FormData`. Ya está aplicado en litros/kilometraje
  (combustible), tanque/odómetro inicial (vehículo) y cantidad
  (compras) — cualquier campo decimal nuevo va con este componente, no
  con `type="number"`.
- **Inputs numéricos controlados: ojo con `Number(e.target.value) ||
  valorAnterior`.** `Number("")` es `0`, que es falsy — un input
  controlado que arma su próximo valor así en `onChange` vuelve al
  anterior apenas el usuario borra el campo para escribir uno nuevo, y
  nunca lo deja terminar de escribir. Pasó con la cantidad editable de
  `/compras/[id]` (`list-editor.tsx`) y con el "Cada" de la recurrencia
  personalizada en `/tareas/definiciones`
  (`definition-form-dialog.tsx`). La solución en los dos: volverlo no
  controlado (`defaultValue` + `key={id}` para remontar si cambia el
  dato externo) y confirmar/validar recién en `onBlur`, revirtiendo ahí
  si quedó vacío o inválido — mientras se escribe, el campo no se pisa
  solo.
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
  dependen de la zona horaria del navegador. `hourInFamilyTimezone()`
  existe por lo mismo: el saludo del inicio no puede usar
  `new Date().getHours()` del celular.

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

`001` a `013` corridas en Supabase y confirmadas funcionando —
incluye el bucket privado `documentos` en Storage (Fase 5), ya creado.

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
| `010_documentos.sql` | `document_categories`, `documents`, `document_files`, FK `assets.document_id`, políticas sobre `storage.objects` (ver sección Fase 5 más abajo). |
| `011_gastos.sql` | `expense_categories`, `expense_groups`, `group_participants`, `expenses`, `expense_shares`, `settlements` + RLS + grants, función `hogar.save_expense()` y seed de categorías para las familias existentes (ver sección Fase 6 más abajo). |
| `012_telegram_bot.sql` | `telegram_sessions` y `telegram_updates`: RLS con política `using (false)`, **sin** grants a `authenticated`/`anon` (revocados explícitos, porque el default privilege de la 005 se los daría), grants solo a `service_role` (ver sección Fase 7). |
| `013_save_expense_bot.sql` | `hogar.save_expense()` acepta `family_id`/`created_by` en el payload **solo** si quien llama es `service_role` y no hay sesión; verifica que el grupo y el miembro sean de esa familia. Para `authenticated` no cambia nada (ver sección Fase 7). |

La próxima migración de cualquier fase nueva es `014_*.sql`. Confirmá el
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

  **El bot conversacional (Fase 7) es el segundo lugar con el mismo
  riesgo que el feed ICS**: corre con el admin client y sin RLS, sobre
  ids que llegan en `callback_data` (los manda Telegram, pero los puede
  fabricar cualquiera que le escriba al bot). Por eso todo pasa por
  `lib/services/`, donde **cada consulta filtra por `family_id` a mano**,
  con la familia resuelta desde `telegram_user_id`. Ver la sección
  "Fase 7".

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
  - `/` — inicio: lanzador con un acceso directo por módulo arriba y el
    resumen del día (eventos, tareas si el módulo está prendido,
    documentos por vencer, lista abierta) abajo. **No** es un tablero;
    ver la Fase Extra.
  - `/config` — índice de configuración (pestaña "Ajustes" del tab bar).
    Agrupa familia, catálogos, avisos y sesión.
  - `/compras`, `/compras/nueva`, `/compras/[id]`, `/compras/[id]/comprar`,
    `/compras/plantillas`, `/compras/plantillas/[id]`
  - `/eventos` — calendario (grilla mensual + agenda), Fase 2.
  - `/config/familia`, `/config/miembros`, `/config/categorias`
  - `/mas` — redirect permanente a `/config`. La pestaña "Más" dejó de
    existir en la Fase Extra; la ruta se mantiene porque puede estar
    guardada en el historial o en un acceso directo del celular.
  - `/config/miembros/[id]` — ficha del miembro: sus documentos agrupados
    por categoría, próximos eventos y tareas asignadas, Fase 5.
  - `/config/calendario` — link del feed ICS + rotar token, Fase 2.
  - `/config/telegram` — vinculación de cuenta de Telegram, Fase 2.
  - `/tareas` — vencidas/semana/próximas, completar y omitir, Fase 3.
  - `/tareas/definiciones`, `/tareas/definiciones/[id]` — ABM de
    definiciones de tareas + historial, Fase 3.
  - `/tareas/activos`, `/tareas/activos/[id]` — ABM de activos del hogar
    (electrodomésticos, instalaciones, vehículos) + historial de
    mantenimiento, Fase 3. También enlazado desde `/config` (catálogos).
  - `/combustible` — listado de vehículos con último rendimiento,
    promedio, costo por km y última carga, Fase 4.
  - `/combustible/nueva` — carga rápida de combustible, Fase 4.
  - `/combustible/vehiculos` — ABM de vehículos, Fase 4.
  - `/combustible/[vehicleId]` — detalle: estadísticas, gráficos,
    historial editable/borrable y tareas de mantenimiento del activo
    vinculado, Fase 4. También enlazado desde la grilla del inicio.
  - `/documentos` — buscador + fijados + filtros por miembro/categoría,
    sin carpetas, Fase 5.
  - `/documentos/nuevo` — cámara o galería, compresión en el cliente,
    metadatos, Fase 5.
  - `/documentos/[id]` — visor (zoom, navegación entre páginas, PDF en
    pestaña nueva), editar metadatos, agregar/quitar páginas, Fase 5.
  - `/config/documentos` — ABM de categorías de documentos + espacio
    usado, Fase 5. También enlazado desde `/config` (catálogos).
  - `/config/activos` — redirect a `/tareas/activos`, Fase 6. Es la
    entrada de los activos desde los catálogos de `/config`; las rutas
    de activos no se movieron.
  - `/config/gastos` — ABM de categorías de gastos (+ "agregar
    sugeridas"), Fase 6.
  - `/gastos` — grupos abiertos (con total y tu balance) y cerrados,
    Fase 6. `/gastos/nuevo` (alta completa) y `/gastos/nuevo?rapido=1`
    (grupo rápido).
  - `/gastos/[id]` — encabezado con total y tu balance + pestaña
    Gastos; `/gastos/[id]/balances` — pestaña Balances (clearing,
    registrar pago, historial, compartir resumen);
    `/gastos/[id]/nuevo` — carga rápida de gasto;
    `/gastos/[id]/editar/[expenseId]` — editar/eliminar un gasto;
    `/gastos/[id]/participantes` — sumar/quitar participantes. Fase 6.
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
6. **Renombrar una lista** (`renameShoppingList` en
   `app/(app)/compras/[id]/actions.ts`, `RenameListDialog`) está en el
   mismo lugar que eliminar: edición de lista y resumen de lista
   cerrada. Pensado para cuando hay varias listas abiertas a la vez (ej.
   "Súper semanal" vs "Farmacia") y hace falta diferenciarlas de un
   vistazo en `/compras`.
7. **El historial de listas cerradas en `/compras` es clickeable.** Cada
   fila linkea a `/compras/[id]/comprar`, que ya mostraba el detalle de
   la compra (`ClosedListSummary`, productos y total) pero no tenía
   forma de llegar ahí desde el historial.

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
6. ~~El notificador de Telegram es de una vía.~~ Superado por la Fase 7:
   el webhook ahora delega en el router del bot conversacional
   (`lib/telegram/router.ts`). `/vincular <código>` sigue igual (se movió
   a `lib/telegram/flows/vincular.ts` sin cambios).
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
9. **El aviso por Telegram arranca activado al crear un evento nuevo**
   (`EventFormDialog`). Antes arrancaba apagado, lo cual era fácil de
   pasar por alto — editar un evento existente sigue respetando lo que
   ya tenía guardado, activado o no.
10. **Los campos de hora y hora de fin van apilados, no lado a lado.**
    Un `<input type="time">` tiene un ancho intrínseco de contenido que
    un flex item no reduce por debajo salvo `min-width: 0` explícito —
    dos columnas al 50% dentro del diálogo (~313px de ancho útil)
    hacían que cada campo se desbordara de su columna y pisara al de al
    lado.

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
13. **El campo "Cada" de la recurrencia personalizada**
    (`recurrence_every` en `definition-form-dialog.tsx`) es un input no
    controlado que confirma en `onBlur`, mismo patrón que la cantidad
    editable de compras — ver "Inputs numéricos controlados" en la
    sección de UI. Es un entero ("cada N meses"), no un decimal, así que
    no usa `DecimalInput`.

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

## Fase 5 — Centro de Documentos: decisiones a respetar

1. **Los archivos viven en `storage.objects`, un sistema de permisos
   separado del schema `hogar`.** Las políticas RLS de la tabla
   `documents` no protegen el acceso a los archivos en sí — un bucket
   privado sin políticas propias sobre `storage.objects` no aísla nada
   entre familias. La ruta de cada archivo es
   `{family_id}/{document_id}/{nombre_archivo}`, y las políticas
   comparan el primer segmento contra `hogar.current_family_id()` (ver
   migración `010`). El bucket `documentos` se crea a mano desde el
   dashboard de Supabase (no hay forma de fijar `file_size_limit` /
   `allowed_mime_types` por SQL desde acá), con `public = false`.
2. **Signed URLs de 60 segundos, generadas con el cliente de sesión
   (`lib/supabase/server.ts`), nunca con el admin client.** A diferencia
   del feed ICS de la Fase 2, acá sí hay sesión — usar el admin client
   saltearía las políticas de `storage.objects` sin necesidad, que es
   justo el mecanismo que garantiza el aislamiento entre familias. Ver
   `lib/documents/storage.ts`.
3. **`document_files` es una tabla aparte, no una columna en
   `documents`.** Una cédula tiene frente y dorso, un estudio médico
   tiene varias páginas — modelar un archivo por documento obligaría a
   cargarlos como documentos distintos, exactamente lo que no querés
   estar decidiendo en una emergencia. El documento es la unidad
   conceptual; los archivos son sus páginas.
4. **Sin carpetas, a propósito.** `/documentos` se navega con buscador +
   fijados (`is_pinned`) + filtros por miembro y categoría, combinables
   — un documento puede ser a la vez de un miembro, de una categoría
   médica y tener un tag de "importante", cosa que una jerarquía de
   carpetas no permite sin elegir una sola dimensión. Este módulo se abre
   en una emergencia (la cédula, el carnet del seguro): un filtro es un
   toque, una carpeta son varios.
5. **`documents.member_id` decide si el documento es personal o
   familiar.** Con miembro → documento de esa persona (incluye menores
   sin login, se vinculan igual que un adulto). Sin miembro (`null`) →
   documento de la familia (contrato de alquiler, seguro de la casa). El
   formulario de carga lo hace explícito con "De la familia" como primera
   opción del selector, no como un campo opcional escondido.
6. **Compresión de imágenes en el cliente antes de subir**
   (`lib/documents/image.ts`): lado mayor ≤ 1600px, JPEG al 80% —
   4-5 MB de una foto de celular bajan a algo del orden de 250 KB. Usa
   `createImageBitmap(file, { imageOrientation: "from-image" })` para la
   rotación EXIF en vez de parsear el metadato a mano — el navegador ya
   sabe hacerlo. Si el navegador no puede decodificar el archivo (HEIC de
   iPhone que no se convirtió solo), sube el original sin comprimir en
   vez de fallar: un documento pesado guardado es mejor que uno perdido.
   Los PDF nunca pasan por esta compresión, van directo con el límite de
   tamaño.
7. **Orden de subida: primero el archivo, después la fila de
   `document_files`.** Para tener una ruta de Storage hace falta el
   `document_id`, así que el orden real es: crear la fila de `documents`
   (sin archivos) → subir cada archivo con esa ruta → insertar su fila en
   `document_files`. Si ese último insert falla, se borra el archivo ya
   subido. El peor caso es un archivo huérfano invisible en Storage, no
   una fila apuntando a un archivo que no existe. Ver `createDocument` en
   `app/(app)/documentos/actions.ts`.
8. **`expires_at` + `expiry_notified_at` (fecha, no booleano) para el
   aviso de vencimiento**, mismo patrón que `warranty_notified_at` en
   `assets` y `notified_at` en `task_instances` — permite repetir el
   aviso cada 7 días mientras el documento siga vencido o por vencer, en
   vez de avisar una sola vez para siempre. La lógica vive en
   `lib/documents/schedule.ts`, **independiente** de
   `lib/tasks/schedule.ts` a propósito (ver "qué no hacer" más abajo):
   comparten la forma del problema, no el código.
9. **Los vencimientos de documentos se avisan en el cron diario
   existente (`/api/cron/tareas`), sin cron ni ruta nueva.** El cron
   nació en la Fase 3 como "el cron de tareas"; desde esta fase cubre
   tres fuentes (tareas, garantías, documentos) con el mismo mecanismo.
   Se dejó el nombre de archivo igual para no tener que reconfigurar el
   job en cron-job.org. Destinatario: el `member_id` del documento si
   tiene dueño, si no todos los miembros con Telegram vinculado — mismo
   criterio que garantías de activos (que siempre son de toda la
   familia).
10. **La ficha de un miembro (`/config/miembros/[id]`) es nueva en esta
    fase** — antes `/config/miembros` era solo una lista con edición
    inline. Agrupa los documentos de esa persona por categoría, y de
    paso muestra sus próximos eventos y tareas asignadas: es la vista de
    "todo lo de esta persona" que las carpetas hubieran dado como efecto
    secundario, pero acá es un destino deliberado en vez de un paso
    obligatorio para llegar a un documento.
11. **Qué no hacer:** no usar el admin client para leer documentos o
    generar signed URLs (hay sesión, tiene que resolverlo RLS de
    storage); no hacer público el bucket ni generar URLs públicas; no
    crear un cron ni una ruta nueva para vencimientos; no construir un
    visor de PDF (se abre en pestaña nueva y el navegador hace el
    trabajo); no implementar OCR, versionado de documentos ni carpetas;
    no tocar `lib/recurrence.ts`, `lib/tasks/schedule.ts`,
    `lib/fuel/consumption.ts` ni `lib/ics.ts` por este módulo.

## Fase Extra — Rediseño de interfaz y performance: decisiones a respetar

1. **El inicio es un lanzador, no un tablero.** Arriba van los accesos
   directos (una tarjeta por módulo, `ModuleTile`), abajo el resumen del
   día. El orden importa y fue el pedido explícito: con el tablero
   ocupando toda la pantalla, llegar a combustible o documentos obligaba
   a pasar por la pestaña "Más". Si agregás algo al inicio, va **debajo**
   de la grilla, no entre el saludo y las tarjetas.
2. **Los contadores de las tarjetas solo aparecen cuando reclaman
   atención** (tareas vencidas, documentos por vencer). Un número que
   está siempre presente deja de significar algo. Por el mismo motivo
   **no se muestran datos de combustible en el inicio** — sigue valiendo
   la regla 10 de la Fase 4.
3. **`components/app-shell/modules.ts` es la única fuente de verdad del
   ecosistema.** La grilla del inicio, los encabezados de pantalla, los
   colores de módulo y el rótulo de sección del header salen todos de
   ahí. Las clases de color están escritas completas (`text-mod-compras`,
   no `text-mod-${key}`) porque Tailwind analiza el fuente de forma
   estática y una plantilla no generaría ninguna clase.
4. **Cinco pestañas: Inicio, Compras, Calendario, Gastos, Ajustes**
   (desde la Fase 6, Gastos ocupa el lugar de Tareas; con
   `FEATURES.tareas = true` Tareas vuelve y son seis).
   Combustible, documentos y la ficha de miembro no están en el tab bar
   a propósito: viven en la grilla del inicio, que es un toque desde
   cualquier lado. Eso es lo que permitió borrar "Más", que mezclaba
   módulos de uso diario con ajustes y no decía a dónde llevaba ninguna
   de sus filas. `ROOT_PATHS` (en `modules.ts`) tiene esas rutas (filtra
   `/tareas` según la bandera) y es lo que usan el botón de volver y el
   header.
5. **Configuración es una sola sección.** Todo lo que se ajusta una vez
   y no se toca más está en `/config`, agrupado (familia, catálogos,
   avisos y sincronización, sesión). Los catálogos que además son
   pantallas de módulo (`/tareas/activos`, `/tareas/definiciones`,
   `/combustible/vehiculos`) se listan desde ahí **y** mantienen su
   atajo contextual dentro del módulo — son dos caminos al mismo lugar,
   no dos lugares.
6. **El header ya no tiene engranaje.** Muestra el nombre de la familia
   en las pantallas del tab bar y el módulo en el que estás parado en
   cualquier pantalla interna ("Compras" mientras editás una plantilla),
   que es el dato que se pierde al bajar tres niveles. Tener un
   engranaje en el header *y* una pestaña de ajustes era parte de la
   ambigüedad que este rediseño saca.
7. **Nada de posicionar al pie con números a ojo.** `--nav-total` está
   en `globals.css` y se usa vía `FloatingAction`, `StickyBottomBar` y
   `pb-nav` (ver la sección de UI). Antes cada pantalla repetía
   `bottom-20` / `pb-24`, que en un iPhone con indicador de inicio dejaba
   los botones parcialmente tapados.
8. **El modo supermercado bajó de 257 kB a 146 kB de JS inicial**, y es
   el cambio de performance que más importa porque es la pantalla que
   más se usa y la que peor red tiene (un súper, con el celular en la
   mano). Dos cosas lo lograron, y ninguna debería revertirse sin un
   motivo fuerte:
   - **Se sacó `framer-motion`** (la dependencia ya no está en
     `package.json`). Lo único que hacía era animar el reordenamiento de
     una fila al tildarla; el reordenamiento ahora es instantáneo, que
     en la práctica se lee igual de bien.
   - **El cliente de realtime de Supabase se carga con `import()`
     dinámico dentro del `useEffect`.** Tildar un producto no depende de
     él (va por Server Action con update optimista), así que la lista
     queda usable de inmediato y la sincronización con el otro celular
     se engancha un instante después. El `cancelled` del efecto está
     para no suscribirse a un canal que ya nadie va a cerrar si el
     componente se desmonta antes de que resuelva el import.
9. **Las consultas compartidas están memoizadas con `cache()` de
   React.** `getCurrentFamilyContext()` lo llamaban el layout de `(app)`
   y además cada página, y cada llamada cuesta un `auth.getUser()` (round
   trip a Supabase Auth) más dos consultas. Lo mismo para
   `listEventsWithDetails`, `listPendingInstancesWithDetails`,
   `listExpiringDocuments`, etc. **Cualquier consulta nueva que más de un
   componente del mismo request pueda pedir debería envolverse igual.**
10. **`listActiveMembers` vive en `lib/members.ts`**, y `lib/events/queries.ts`
    y `lib/tasks/queries.ts` la reexportan. Estaba duplicada en los dos
    módulos, y con `cache()` dos copias son dos consultas distintas en el
    mismo request — exactamente lo que dispara el inicio al pintar el
    calendario y las tareas juntos. No la vuelvas a definir localmente.
11. **El inicio se transmite en dos partes con `Suspense`.** El fallback
    de la grilla es la misma grilla sin contadores, así que los números
    caen encima sin mover nada de lugar en vez de dejar la pantalla en
    blanco hasta que responden las cinco consultas.
12. **`optimizePackageImports` en `next.config.ts`** cubre `lucide-react`,
    `date-fns` y `date-fns-tz`: sin eso, una pantalla que importa tres
    íconos arrastra el barrel entero al chunk del cliente.
13. **El service worker no tiene listener de `fetch`.** Uno vacío no
    cambia nada funcionalmente pero obliga al navegador a arrancar el
    service worker antes de cada navegación. Sigue sin haber caché
    offline, a propósito (igual que antes).
14. **Qué no hacer:** no volver a meter colores de Tailwind escritos a
    mano en las pantallas (usá los tokens); no agregar un selector manual
    de tema (lo decide el sistema); no devolverle datos al inicio que lo
    conviertan otra vez en un tablero; no reintroducir una pestaña
    "Más"; no posicionar nada fijo al pie sin `--nav-total`; y no tocar
    `lib/recurrence.ts`, `lib/tasks/schedule.ts`, `lib/fuel/consumption.ts`,
    `lib/documents/schedule.ts` ni `lib/ics.ts` por motivos de interfaz —
    esta fase no cambió ninguna regla de negocio.

## Fase 6 — Tareas apagado y Gastos compartidos: decisiones a respetar

### Parte A — La bandera de Tareas

1. **`lib/features.ts` con `FEATURES.tareas`, una constante en el
   código.** No es una tabla de configuración ni una variable de
   entorno, a propósito: prender o apagar es cambiar el valor y
   desplegar. Una tabla agregaría migración, pantalla de administración
   y una consulta en cada render para algo que se toca dos veces en la
   vida del proyecto. No la "mejores" moviéndola a la base.
2. **Dos banderas desde las mejoras post-Fase 6:** `tareas` (si el
   módulo está a la vista en el inicio) y `tareasAvisos` (si el cron
   genera instancias y avisa por Telegram). Hoy están en `false` y
   `true`: fuera del inicio, pero avisando. Lo que sigue en este punto
   describe `tareas`; el corte del cron es `tareasAvisos`.
   **Qué apaga exactamente `tareas: false`:** la tarjeta de Tareas en el
   lanzador (`LAUNCHER_MODULES` en `modules.ts`) y la pestaña del tab
   bar; el bloque de tareas del resumen del día (ni se consulta); las
   tareas asignadas en `/config/miembros/[id]`; la fila "Definiciones de
   tareas" de `/config`; la lista "Tareas de mantenimiento pendientes"
   de `/combustible/[vehicleId]` y "Tareas asociadas" de
   `/tareas/activos/[id]` (estas dos a pedido del usuario después de la
   primera versión). El cron diario **ya no** depende de esta bandera
   sino de `tareasAvisos`.
3. **Qué NO apaga:** tablas, datos y rutas de tareas siguen ahí y
   funcionan por URL directa. `/config` tiene una sección "Tareas del
   hogar" (Tareas + Definiciones) con una línea que dice si el módulo
   avisa o no según `tareasAvisos` — sin esa línea, dentro de meses
   alguien ve tareas vencidas y no entiende por qué nunca le avisó. Los **activos del hogar** siguen accesibles como
   catálogo (`/config/activos` → `/tareas/activos`) porque ya no son
   solo de Tareas: vehículos (Fase 4) y manuales (Fase 5) los usan. El
   historial de mantenimiento de un activo se sigue mostrando. **Las
   garantías de activos y los vencimientos de documentos siguen
   avisando** en el cron diario.
4. **Con `tareasAvisos: false` el cron no genera, a propósito.** Si
   generara en silencio, al reactivar habría una pila de tareas vencidas
   acumuladas durante meses. Como `next_due_date` no se toca, al volver
   a `true` el generador retoma solo desde donde corresponde (y
   `advanceUntilFuture` ya resuelve el catch-up de las de ancla
   `schedule`). Nada se pierde y nada se acumula. Reactivar es cambiar
   `false` por `true`, sin migraciones.

### Parte B — Gastos compartidos

5. **Alcance: repartir gastos y saber quién le debe a quién.** No es un
   control de gastos personales ni un presupuesto — no le agregues
   reportes por categoría, límites ni nada que lo empuje hacia eso. No
   aparece en el resumen del día (un gasto no vence) y no tiene cron ni
   avisos de Telegram.
6. **Tres columnas de plata por gasto, y hacen falta las tres:**
   `amount` + `currency` (lo que dice el ticket, para verificar contra
   el comprobante), `exchange_rate` (hace auditable la conversión) y
   `amount_pyg` (lo único con lo que se suma un viaje en tres monedas).
   `amount_pyg` es **columna generada** (`round(amount *
   exchange_rate)`): no hay código que la mantenga sincronizada.
7. **La cotización es editable después.** Con tarjeta de crédito el
   banco liquida días más tarde. El grupo tiene `default_rates` por
   moneda que se precargan en cada gasto; cada gasto puede
   sobreescribirla y editarla luego desde `/gastos/[id]/editar/…`. Si
   un gasto se guarda en una moneda sin cotización por defecto, esa
   cotización queda como default del grupo (nunca pisa una existente).
   Sin conversión automática por API.
8. **Guaraníes enteros y redondeo determinístico
   (`lib/expenses/split.ts`).** Cada parte es un entero y la suma de las
   partes es **exactamente** `amount_pyg`. El resto de la división se
   reparte de a 1 Gs por mayor resto, con empates resueltos por el orden
   fijo de participantes (`sort_order`, después `created_at`, después
   `id`); con partes iguales equivale a "el resto a los primeros". Todo
   con BigInt para no perder un guaraní por punto flotante.
   `toAmountPyg` reproduce el redondeo de la columna generada, y por eso
   el importe se rechaza con más de 2 decimales y la cotización con más
   de 6 (la base los redondearía en silencio y los números dejarían de
   coincidir). En guaraníes, los campos de importe son solo dígitos
   (`inputMode="numeric"`), no `DecimalInput`: "150.000" tipeado con
   punto de miles tiene que ser 150.000, no 150.
9. **Las partes se materializan SIEMPRE en `expense_shares`**, aunque la
   división sea en partes iguales. `split_method` y `weight` solo sirven
   para reabrir el editor en el mismo modo. Mismo principio que los
   items de compras (Fase 1): sumar un participante el día 5 del viaje
   no reescribe lo que cada uno debía el día 1. No las calcules al
   vuelo. En "importes exactos" los montos se escriben en la moneda del
   gasto; se valida que sumen el importe del ticket (si no, se muestra
   la diferencia y **no se guarda**) y después se reparte `amount_pyg`
   en proporción. `weight` no se usa en ese modo (numeric(8,2) no alcanza
   para importes en guaraníes): el editor reconstruye los importes desde
   `share_pyg / exchange_rate` (`exactAmountsFromShares`).
10. **`hogar.save_expense()` guarda gasto y partes en una transacción**
    (migración 011, `security invoker`, así que RLS aplica adentro).
    PostgREST no tiene transacciones entre requests: con dos inserts
    separados, un fallo en el medio deja un gasto sin partes. Y al
    editar la cotización `amount_pyg` cambia solo, así que las partes
    tienen que reescribirse en el mismo paso. La función rechaza el
    gasto (errcode `23514`) si las partes no suman exacto, si el pagador
    o alguna parte no es del grupo. La división en sí **no** vive en SQL:
    la calcula `saveExpense` en el servidor con `split.ts` — nunca se
    confía en partes calculadas por el cliente (el cliente solo muestra
    una vista previa).
11. **Balances en vivo e invariante de suma cero
    (`lib/expenses/settlement.ts`).** `balance = pagado − partes + pagos
    hechos − pagos recibidos`, sobre los datos actuales, desde el primer
    gasto. **`status` (`abierto`/`cerrado`) no condiciona ningún
    cálculo**: es solo archivo, y un grupo cerrado se reabre. La suma de
    todos los balances de un grupo tiene que dar 0; el encabezado, la
    lista de grupos y `/gastos/[id]/balances` lo verifican y avisan en
    vez de mostrar números que no cierran (y en ese caso no se proponen
    transferencias).
12. **Clearing greedy (`simplifyDebts`)**: mayor acreedor contra mayor
    deudor, se salda el menor importe, se repite. Determinístico
    (empates por orden del grupo). "Registrar pago" crea un
    `settlement` y todo se recalcula solo en la próxima lectura.
13. **Participantes: miembro (`member_id`, hereda nombre y color) o
    invitado por grupo (solo nick).** Sin directorio global de personas
    externas. `display_name` es snapshot. Quitar un participante lo
    borra solo si no tiene gastos pagados, partes ni pagos; si tiene, se
    desactiva (`is_active = false`): no aparece para gastos nuevos pero
    sigue contando en los balances. Un solo pagador por gasto — si dos
    pagaron el hotel a medias, son dos gastos.
14. **Consultas paginadas (`lib/expenses/queries.ts`).** PostgREST corta
    en 1000 filas por defecto; un viaje largo con cinco personas pasa
    ese número de partes, y un truncado silencioso rompería el
    invariante sin que nadie supiera por qué. Todo lo que alimenta un
    cálculo se trae con `fetchAllPages`.
15. **El ticket usa el Centro de Documentos (Fase 5).** `saveExpense`
    llama a `createDocument` tal cual (título "Ticket: …", tipo
    `factura`) con la imagen ya comprimida en el cliente por
    `compressDocumentImage`; si después falla el guardado del gasto, se
    borra el documento recién creado. No hay nada nuevo de storage.
16. **Categorías de gastos**: sembradas por la migración 011 para las
    familias existentes; una familia nueva las trae con "Agregar
    sugeridas" en `/config/gastos`. `icon` guarda un nombre de ícono de
    lucide que resuelve `categoryIcon` en `lib/expenses/constants.ts`.
17. **Qué no hacer:** no borrar tablas, datos ni rutas de tareas; no
    mover la bandera a la base; no permitir varios pagadores; no crear un
    directorio global de invitados; no calcular partes al vuelo; no
    condicionar cálculos al `status`; no construir storage propio para
    tickets; no agregar cron, Telegram ni conversión automática de
    monedas; no tocar `lib/recurrence.ts`, `lib/tasks/schedule.ts`,
    `lib/fuel/consumption.ts`, `lib/documents/schedule.ts` ni
    `lib/ics.ts` por este módulo.

## Mejoras post-Fase 6: decisiones a respetar

Implementadas y verificadas en producción. Ninguna agregó migraciones ni
variables de entorno; la próxima migración sigue siendo la `012`.

1. **Rendimiento en L/100 km por defecto, configurable a km/L.** El
   cálculo sigue en km/L dentro de `lib/fuel/consumption.ts` (que no se
   tocó: intervalos, promedio y alerta de consumo excesivo siguen igual);
   la conversión es solo de presentación, en `lib/fuel/efficiency.ts`
   (`formatEfficiency`, `efficiencyValue`). L/100 km es la inversa exacta
   de km/L, así que el mejor y el peor tramo siguen siendo los mismos
   (con L/100 km el mejor es el número más bajo, y en el gráfico más
   arriba es más consumo). La preferencia es **por dispositivo**, en la
   cookie `fuel_unit` (selector en `/combustible`, Server Action
   `setFuelUnit`, lectura con `getFuelUnit` en `lib/fuel/unit.ts`): una
   preferencia de lectura no justifica una columna ni una migración.
2. **Lista de compras sin plantilla.** `/compras/nueva` permite crear la
   lista vacía (botón "Crear lista vacía" cuando no hay productos
   tildados) y se llena desde `/compras/[id]` con el producto suelto de
   siempre. `source_template_ids` queda en `null` en ese caso.
3. **"Almacén" es la categoría por defecto de un producto nuevo**, en la
   lista (`add-item-form.tsx`) y en la plantilla
   (`template-item-form-dialog.tsx`), vía `defaultProductCategoryId` en
   `lib/normalize.ts`: se busca por nombre normalizado ("almacen")
   porque las categorías son de cada familia y no hay un id fijo. Si no
   existe, "Sin categoría". Editar un producto respeta la que ya tenía.
4. **La vista de una plantilla se agrupa por categoría (en el orden del
   recorrido, `sort_order`) y dentro por nombre** (`localeCompare` en
   español). Se sacó el arrastrar y soltar de los productos de plantilla
   (y la acción `reorderTemplateItems`): con varias plantillas ese orden
   manual se volvía arbitrario. El modo supermercado no cambió: ya
   agrupaba por categoría.
5. **Eventos del resumen del inicio con el día explícito** ("Hoy",
   "Mañana") arriba de la hora, calculado en la zona de la familia
   (`dateOnlyInFamilyTimezone`). Un evento de varios días que empezó
   antes cuenta como "Hoy".
6. **Tareas: avisos de nuevo y alta visible.** `FEATURES.tareasAvisos =
   true` reactiva la generación y los avisos del cron sin volver a
   mostrar el módulo en el inicio. `/tareas` tiene botón flotante de
   "Nueva tarea" (antes solo se creaba desde el engranaje, en
   `/tareas/definiciones`). Crear o editar una definición genera su
   instancia en el momento si ya corresponde (`generateInstanceIfDue`
   en `app/(app)/tareas/definiciones/actions.ts`, misma regla
   `shouldGenerateInstance` que el cron): sin eso, una tarea recién
   creada no aparecía hasta la corrida de las 07:00 del día siguiente
   (o nunca, con el cron apagado) y parecía que no se había guardado.
   El `unique(definition_id, due_date)` hace inofensivo el choque con el
   cron. `lib/tasks/schedule.ts` no se tocó.

## Fase 7 — Bot conversacional de Telegram: decisiones a respetar

### La capa de servicios (`lib/services/`)

1. **Por qué existe.** Antes de esta fase toda mutación vivía en una
   Server Action que derivaba la familia de la sesión vía RLS. El bot no
   tiene sesión: llega por webhook, se identifica por `telegram_user_id`
   y trabaja con el admin client. Reimplementar en el webhook "agregar un
   producto", "dividir un gasto" o "validar una carga" dejaría dos
   versiones de cada regla, y la del bot se quedaría atrás sin que nadie
   se entere (un gasto sin el reparto determinístico del resto rompe el
   invariante de suma cero). Por eso la lógica se movió a funciones que
   reciben **`db`, `familyId` y `memberId` como parámetros explícitos**
   (`Actor`, `Db` y `ServiceResult` en `lib/services/types.ts`).
2. **Las Server Actions son envoltorios finos**: validan el formulario,
   resuelven `familyId`/`memberId` con `getCurrentFamilyContext()`, le
   pasan el cliente de sesión al servicio y hacen `revalidatePath` /
   `redirect`. El refactor fue **movimiento de código**: mismos mensajes
   de error, mismo orden de validaciones, misma respuesta. El bot llama
   a los mismos servicios con el admin client.
3. **Cada consulta de un servicio filtra por `family_id` en el código**,
   aunque con el cliente de sesión RLS ya lo haga. Con el admin client
   ese `.eq("family_id", familyId)` es lo único que separa a una familia
   de otra — mismo cuidado que el feed ICS. Un servicio nuevo que se
   olvide de ese filtro es una fuga entre familias por el bot.
4. **Qué se movió (solo lo que el bot usa, módulo por módulo):**
   - `compras.ts`: lista abierta, ítems, categorías, plantillas, crear
     lista (dedup + snapshot), tildar, pasar a "en curso", producto
     suelto, y `productCategoryGuesser` (categoría de un producto escrito
     a mano: la de la plantilla si existe, si no "Almacén").
   - `gastos.ts`: `prepareExpense` (importe, cotización, división con
     `split.ts`) y `persistExpense` (`save_expense()` + cotización por
     defecto del grupo), `listGroupSummaries`, `fetchAllPages`,
     `sortParticipants`. `saveExpense` (la acción) hace prepare → ticket
     → persist, igual que antes.
   - `combustible.ts`: `createFuelLog` (devuelve `error` / `warnings` /
     `saved`) y lecturas de vehículos y cargas.
     `lib/fuel/validation.ts` ganó `buildFuelLogWarningDetails` (la misma
     lista con un código por advertencia, para que el bot sepa cuándo
     ofrecer "me olvidé de una carga"); `buildFuelLogWarnings` sigue
     devolviendo los mismos textos.
   - `tareas.ts`: `completeTaskInstance` y las instancias pendientes.
   - `eventos.ts`: eventos con participantes/recordatorios y miembros
     activos (lecturas para `/hoy`).
   Las consultas memoizadas de la app (`lib/*/queries.ts`,
   `lib/members.ts`) delegan en estos servicios en vez de repetir la
   consulta. **No** se tocaron módulos que el bot no usa (documentos,
   eventos ABM, activos, vehículos ABM, plantillas, etc.).
5. **`hogar.save_expense()` y el service role (migración 013).** La
   función tomaba la familia de `current_family_id()`, que es `null` sin
   sesión. La 013 la deja tomar `family_id`/`created_by` del payload
   **solo** si `current_user = 'service_role'` (el rol al que cambia
   PostgREST; un usuario autenticado no puede hacerse pasar por él), y
   agrega las verificaciones que RLS hacía sola: el grupo y el miembro
   son de esa familia, la edición filtra por `family_id`. Para la app no
   cambia nada. Se descartó insertar gasto y partes por separado desde
   el bot: se perdería la transacción.

### El bot (`lib/telegram/`)

6. **Estructura.** `client.ts` (absorbió el viejo `lib/telegram.ts`:
   `sendTelegramMessage` y `escapeTelegramHtml` se comportan igual, y
   `sendTelegramMessage` acepta botones opcionales), `router.ts`,
   `session.ts`, `keyboards.ts`, `context.ts` (`show`: editar o mandar)
   y `flows/` (`compras`, `gastos`, `combustible`, `hoy`, `vincular`).
   **Los flujos no consultan la base para lógica de negocio**: llaman a
   `lib/services/`. Sin dependencias de bot (nada de Telegraf/grammY):
   `fetch` contra la Bot API.
7. **Orden del router, y por qué:** (1) solo chats privados — en un
   grupo no se sabe quién pide qué, y se cargarían gastos a nombre
   equivocado; un update de grupo se ignora sin responder. (2)
   Deduplicación por `update_id`: se inserta en `telegram_updates`
   **antes** de procesar; si choca contra la primary key, ya se procesó
   (Telegram reintenta si tardás, y un reintento de "guardar gasto"
   duplicaría el gasto). (3) `answerCallbackQuery` enseguida en cada
   toque, en paralelo con el trabajo (si no, el botón queda con el reloj
   girando y la persona toca de nuevo). (4) Vinculación: `/start` y
   `/vincular` andan siempre; cualquier otra cosa de alguien no
   vinculado recibe la instrucción de vincularse y nada más. (5) Un
   comando descarta el diálogo en curso; un texto suelto se interpreta
   según el paso del diálogo.
8. **El miembro sale SIEMPRE de `family_members.telegram_user_id`** en
   cada update, nunca de la sesión ni de `auth.users`. La sesión guarda
   `member_id`/`family_id` como caché; si no coinciden con la
   vinculación actual (se desvinculó, se vinculó a otra familia), el
   diálogo se descarta.
9. **`callback_data` tiene un límite duro de 64 bytes.** Un UUID son
   36: entra uno con un prefijo corto, dos nunca. Todo payload es
   `acción:identificador` (a lo sumo un número chico extra, como la
   página de la lista: `lp:<listId>:<n>`). El resto del contexto (grupo
   elegido, monto, borrador) va en `telegram_sessions.context`.
   `button()` en `keyboards.ts` revienta si un payload se pasa de 64
   bytes — es un error de programación, mejor verlo en el primer
   intento. Prefijos: `l*` compras, `g*` gastos, `f*` combustible,
   `th`/`ag`/`hl` avisos y `/hoy`, `m:` menú, `x` cancelar, `nop` rótulo.
10. **Sesiones de 10 minutos** (`SESSION_TTL_MS`). Un diálogo abandonado
    no puede tomar un mensaje suelto de mañana como "el monto del gasto".
    El paso vence; el "mensaje vivo" (`last_message_id`) no — los
    botones de la lista de compras no dependen de la sesión y siguen
    andando en un mensaje viejo.
11. **Guardar es atómico (`claimDialog`).** Dos toques de "Guardar" son
    dos updates distintos, así que la deduplicación por `update_id` no
    los frena. `claimDialog` limpia el estado con un
    `UPDATE … WHERE state = 'gasto:confirmar'` y solo el que gana guarda.
    Ojo: ese `UPDATE` **no** vacía `context` — `RETURNING` devuelve la
    fila ya actualizada y se perdería el borrador (pasó en la primera
    versión).
12. **Botones, no sintaxis.** Texto libre solo donde no hay
    alternativa: importe, kilometraje, litros, nombre de producto. Al
    tocar un botón se **edita** el mensaje existente (`show` en
    `context.ts`); cuando el paso lo dispara un texto, al mensaje
    anterior se le sacan los botones y el paso nuevo va abajo. Tildar un
    producto no pide confirmación (mismo criterio que el modo
    supermercado).
13. **Compras.** Paginado por categoría en el orden del recorrido, con
    la misma agrupación que el modo supermercado; tachado con U+0336 en
    el botón (los botones no admiten HTML). Tildar desde el bot pasa la
    lista a "en curso", igual que abrir el modo supermercado. "Agregar"
    acepta `leche 2` (cantidad al final) y varios productos, uno por
    línea; la categoría sale de la plantilla si el producto ya existe, si
    no "Almacén". Cerrar la compra (con total) sigue siendo de la app.
14. **Gastos.** Defaults agresivos para que el camino rápido sea dos
    textos y dos toques: paga quien escribe (si participa; si no, se
    pregunta), partes iguales entre los participantes activos, fecha de
    hoy, método de pago del último gasto del grupo. `45000 cena` toma
    importe y descripción juntos; en guaraníes "150.000" es 150000. Las
    monedas que se ofrecen son guaraníes más las que tienen cotización
    por defecto en el grupo. La confirmación muestra las partes que
    calculó `prepareExpense` — las mismas que se guardan. Por pesos o
    importes exactos: en la app.
15. **Combustible.** Mismas validaciones que la pantalla vía
    `createFuelLog`; las advertencias se muestran con "Guardar igual",
    "Corregir km" y, si el rendimiento da implausible, "Me olvidé de
    registrar una carga anterior" (`resets_calculation`). En el chat el
    kilometraje acepta punto de miles ("45.320"); los litros, coma o
    punto decimal. El rendimiento se muestra en L/100 km con km/L entre
    paréntesis (la preferencia por cookie de la app no existe en el bot).
16. **`/hoy`** es de solo lectura y sin estado: eventos de hoy y mañana
    (vía `buildDisplayEvents`, sin duplicar la expansión de
    recurrencia), tareas vencidas (si `FEATURES.tareas` o
    `tareasAvisos`), lista abierta con lo que falta y el balance propio
    en cada grupo de gastos abierto. Todo en una sola tanda de consultas
    en paralelo.
17. **Botones en los avisos de los crons.** El aviso diario agrega un
    "✓ Hecha: …" por tarea (`th:<instanceId>`): completa con el mismo
    servicio que `/tareas` y edita los botones del mensaje. Si la tarea
    ya no está pendiente (la marcó otro, doble toque) no la vuelve a
    completar — completar dos veces correría el vencimiento dos veces.
    Los recordatorios de eventos traen "📅 Ver agenda del día"
    (`ag:<yyyy-MM-dd>`, fecha de la ocurrencia en la zona de la
    familia). Garantías y documentos no tienen acción por chat.
18. **`telegram_updates` se limpia en el cron diario**
    (`/api/cron/tareas`): filas de más de 7 días. Los reintentos de
    Telegram llegan en minutos.
19. **Menú de comandos**: se registra a mano con `setMyCommands` (no hay
    código que lo haga en cada deploy): `menu`, `hoy`, `compra`,
    `gasto`, `nafta`, `cancelar`. El router acepta además `/start`,
    `/compras`, `/combustible` y `/vincular`.
20. **Qué no hacer:** no reimplementar lógica de negocio en el webhook ni
    en `lib/telegram/flows/` (todo pasa por `lib/services/`); no usar el
    admin client sin filtrar por `familyId`; no meter dos UUIDs en un
    `callback_data`; no responder a chats de grupo; no crear eventos por
    chat ni subir documentos por foto (fuera de alcance a propósito); no
    implementar divisiones avanzadas de gastos por chat; no agregar
    librerías de bot; no tocar `lib/recurrence.ts`,
    `lib/tasks/schedule.ts`, `lib/fuel/consumption.ts` ni `lib/ics.ts`
    por este módulo.

## Comandos útiles

```bash
npm run dev       # servidor de desarrollo
npm run build     # build de producción — debe pasar sin errores de TS
npm run lint
```

No ejecutes `vercel` ni ningún comando del CLI de Vercel: el proyecto se
vincula desde el dashboard. No ejecutes comandos del Supabase CLI contra
la base remota (ver arriba).
