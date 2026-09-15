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
- Migraciones `001` a `005` aplicadas en la base compartida. Antes de
  escribir la migración `006`, mirá `supabase/migrations/` para confirmar
  el próximo número — no lo asumas.
- **Próximo hito: Fase 2.** Sus módulos — eventos, tareas, documentos,
  combustible, bot de Telegram — están mencionados en el diseño original
  pero **este repo no tiene el detalle de esa fase** (el prompt con el
  que se armó Fase 0 + Fase 1 solo especificaba esas dos). Si arrancás
  una sesión para Fase 2 sin que el usuario haya pegado el spec de esa
  fase en el prompt, pedíselo antes de crear tablas, rutas o componentes
  — no los inventes a partir del nombre del módulo. El bottom nav ya
  tiene placeholders "Próximamente" para `/eventos` y `/tareas`;
  "Documentos" y "Combustible" hoy solo aparecen listados (sin ruta) en
  `/mas`.
- **Lecciones de la puesta en producción** (relevantes para cualquier
  módulo nuevo, no solo compras): ver la regla 10 de la sección
  siguiente sobre grants de tabla, y la nota de la regla 7 sobre
  `ensure_family_membership`. Ambas costaron varias rondas de debugging
  real con logs de Vercel — no son hipotéticas.

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
  crons de fases futuras (todavía no existen) y el callback de OAuth
  (`app/auth/callback/route.ts`), que por protocolo tiene que ser un
  Route Handler GET.
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

### Migraciones aplicadas (referencia rápida)

Todas corridas a mano en Supabase y confirmadas funcionando en producción:

| Archivo | Contenido |
| --- | --- |
| `001_nucleo.sql` | `families`, `family_members`, funciones helper, trigger de alta, RLS. |
| `002_compras.sql` | Tablas de compras (categorías, plantillas, listas, items) + RLS + realtime. |
| `003_ensure_family_membership.sql` | Vinculación idempotente por RPC (ver regla 7). |
| `004_grants_funciones.sql` | `GRANT EXECUTE` para funciones llamadas por RPC (ver regla 7). |
| `005_grants_tablas.sql` | `GRANT SELECT/INSERT/UPDATE/DELETE` base sobre tablas (ver regla 10). |

La próxima migración de cualquier fase nueva es `006_*.sql`. Confirmá el
número real mirando la carpeta antes de crearla, por si esto queda
desactualizado.

## Variables de entorno

Las variables de entorno se cargan **solo en Vercel** — no hay
`.env.local` en este proyecto ni se debe crear uno con valores reales.
En tiempo de ejecución deben existir:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo server, nunca en código de cliente)

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
  - `/` — dashboard "Hoy"
  - `/compras`, `/compras/nueva`, `/compras/[id]`, `/compras/[id]/comprar`,
    `/compras/plantillas`, `/compras/plantillas/[id]`
  - `/config/familia`, `/config/miembros`, `/config/categorias`
  - `/eventos`, `/tareas`, `/mas` — placeholders "Próximamente" hasta que
    se implementen esas fases.

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

## Comandos útiles

```bash
npm run dev       # servidor de desarrollo
npm run build     # build de producción — debe pasar sin errores de TS
npm run lint
```

No ejecutes `vercel` ni ningún comando del CLI de Vercel: el proyecto se
vincula desde el dashboard. No ejecutes comandos del Supabase CLI contra
la base remota (ver arriba).
