# App Familiar

Aplicación web para organizar la vida doméstica de una familia: compras
del supermercado, eventos, tareas del hogar, documentos y consumo de
combustible. Pensada para uso en celular, por los adultos de una misma
familia.

Este repositorio implementa **Fase 0 (base)**, **Fase 1 (compras)**,
**Fase 2 (eventos, calendario y notificaciones de Telegram)**, **Fase 3
(tareas del hogar)**, **Fase 4 (combustible)**, **Fase 5 (centro de
documentos)** y la **Fase Extra (rediseño de interfaz y performance)**.
Ver [`CLAUDE.md`](./CLAUDE.md) para las convenciones del proyecto y el
detalle de qué está implementado y qué no.

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 + shadcn/ui ·
Supabase (Postgres + Auth) · Zod · date-fns (zona `America/Asuncion`) ·
Vercel.

## Variables de entorno

Las variables de entorno **se configuran únicamente en Vercel**
(Project Settings → Environment Variables) — este repo no incluye un
`.env.local`. En tiempo de ejecución tienen que existir:

| Variable | Dónde se usa | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente y servidor | URL del proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente y servidor | Clave anónima (pública) de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | solo servidor | Clave de service role. Nunca se expone al cliente. |
| `NEXT_PUBLIC_APP_URL` | servidor (UI) | URL pública de la app, para armar el link del feed ICS en `/config/calendario`. |
| `TELEGRAM_BOT_TOKEN` | solo servidor | Token del bot de Telegram (de `@BotFather`). Usado para enviar mensajes y para `getMe` en la pantalla de vinculación. |
| `TELEGRAM_WEBHOOK_SECRET` | solo servidor | String aleatorio que Telegram manda de vuelta en cada request al webhook (`X-Telegram-Bot-Api-Secret-Token`), para verificar que el request es legítimo. |
| `CRON_SECRET` | solo servidor | Protege `GET /api/cron/recordatorios` (`Authorization: Bearer <CRON_SECRET>`), la única llamada permitida es la del cron externo. |

Ninguna de las nuevas lleva el prefijo `NEXT_PUBLIC_` salvo
`NEXT_PUBLIC_APP_URL`, que es pública a propósito (se usa para armar un
link que se muestra en la UI). Si falta alguna variable requerida,
`lib/env.ts` lanza un error claro en vez de fallar en silencio.

## Base de datos

El proyecto de Supabase está **compartido con otras aplicaciones**. Todo
el esquema de esta app vive en el schema `hogar` (nunca en `public`), y
las migraciones son archivos `.sql` numerados en `supabase/migrations/`
que se aplican **a mano desde el SQL Editor de Supabase** — no se
ejecuta el CLI de Supabase contra la base remota desde este repositorio.

Orden de aplicación:

1. `supabase/migrations/001_nucleo.sql` — familias, miembros, RLS,
   trigger de alta de usuario.
2. `supabase/migrations/002_compras.sql` — categorías, plantillas,
   listas de compras, RLS, publicación de realtime.
3. `supabase/migrations/003_ensure_family_membership.sql` — vinculación
   idempotente por RPC.
4. `supabase/migrations/004_grants_funciones.sql` — grants de `EXECUTE`
   para funciones llamadas por RPC.
5. `supabase/migrations/005_grants_tablas.sql` — grants base de tabla
   para el rol `authenticated`.
6. `supabase/migrations/006_eventos.sql` — eventos, participantes,
   recordatorios, vinculación de Telegram (Fase 2).
7. `supabase/migrations/007_grants_service_role.sql` — grants de schema,
   tablas, funciones y secuencias para `service_role`.
8. `supabase/migrations/008_tareas.sql` — activos, definiciones e
   instancias de tareas (Fase 3).
9. `supabase/migrations/009_combustible.sql` — vehículos y cargas de
   combustible (Fase 4).
10. `supabase/migrations/010_documentos.sql` — categorías, documentos,
    archivos y políticas sobre `storage.objects` (Fase 5). Requiere
    además crear a mano el bucket privado `documentos` desde el
    dashboard de Supabase.
11. (Opcional) `supabase/seed/categorias.sql` — categorías típicas de
    supermercado. Reemplazar el `family_id` de ejemplo por el real antes
    de ejecutarlo.

La Fase Extra (rediseño de interfaz y performance) **no agrega ninguna
migración**: es solo código de la app.

Ver más detalle y las reglas críticas (RLS obligatorio, funciones
`security definer`, snapshot de `shopping_list_items`, etc.) en
[`CLAUDE.md`](./CLAUDE.md).

## Desarrollo local

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # build de producción
npm run lint
```

No se ejecuta `vercel` ni comandos del CLI de Supabase desde acá: el
proyecto de Vercel se vincula desde su dashboard, y las migraciones se
aplican a mano en Supabase.
