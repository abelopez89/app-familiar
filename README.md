# App Familiar

Aplicación web para organizar la vida doméstica de una familia: compras
del supermercado, eventos, tareas del hogar, documentos y consumo de
combustible. Pensada para uso en celular, por los adultos de una misma
familia.

Este repositorio implementa **Fase 0 (base)** y **Fase 1 (módulo de
compras)**. Ver [`CLAUDE.md`](./CLAUDE.md) para las convenciones del
proyecto y el detalle de qué está implementado y qué no.

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

Si falta alguna, `lib/env.ts` lanza un error claro en vez de fallar en
silencio.

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
3. (Opcional) `supabase/seed/categorias.sql` — categorías típicas de
   supermercado. Reemplazar el `family_id` de ejemplo por el real antes
   de ejecutarlo.

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
