---
name: auditoria-flujos
description: "Auditar la navegación y los flujos de pantallas de la App Familiar, en celular y escritorio, para simplificar el acceso a las funciones más usadas. Usar cuando pida revisar flujos, accesos, navegación o cantidad de pasos."
---

# Auditoría de flujos de la App Familiar

Objetivo: medir cuántos toques y pantallas cuesta cada tarea frecuente,
en celular y en escritorio, y **proponer** cómo acortarla. Esta skill no
implementa nada: termina en una tabla de propuestas y espera el OK del
usuario.

Antes de empezar, leé `CLAUDE.md`. Las propuestas tienen que respetar
sus reglas, en particular:

- En celular, el inicio es un **lanzador** (Fase Extra, reglas 1, 2 y 14):
  no proponer convertirlo en tablero ni mostrar datos de combustible ahí.
- En escritorio (`lg:`, ≥ 1024px) el inicio **sí** es un tablero, con
  combustible incluido ("Panel web (escritorio)", regla 2). No lo
  "corrijas" hacia el lanzador ni al revés.
- Cinco pestañas en el tab bar, sin "Más"; `modules.ts` es la única
  fuente de verdad de los módulos.
- Tokens de `app/globals.css`, sin colores sueltos; cualquier cambio de
  paleta, tipografía o estilo general se propone y se espera el OK.
- Mejoras mínimas: una por PR. Si una propuesta implica tablas nuevas, un
  módulo nuevo o rediseñar un flujo entero, marcala como tal.

## 1. Inventario de rutas

- Listá las pantallas desde `app/(app)/**/page.tsx` (ruta = carpeta, sin
  el grupo `(app)`) y los Route Handlers que abren archivos.
- Cruzalo con `components/app-shell/modules.ts`: `MODULES`,
  `LAUNCHER_MODULES` (grilla del inicio y menú lateral), `ROOT_PATHS`
  (pantallas raíz del tab bar, sin botón de volver) y
  `lib/features.ts` (`FEATURES.tareas` decide si Tareas está a la vista).
- Anotá para cada ruta: módulo, cómo se llega (tab bar, grilla del inicio,
  menú lateral, botón dentro de otra pantalla, solo por URL) y qué
  parámetros de URL cambian lo que se ve (`?vehicle=`, `?grupo=`,
  `?doc=`, `?nuevo=1`, `?editar=1`, etc.).
- Marcá las rutas huérfanas (solo alcanzables por URL) y las que tienen
  vista de escritorio propia (`escritorio.tsx`).

## 2. Tareas frecuentes a medir

Diarias o casi (criterio de ≤ 2 toques):

1. Agregar un producto a la lista abierta (`/compras/[id]`).
2. Tildar productos en el súper (modo supermercado,
   `/compras/[id]/comprar`).
3. Ver el evento de hoy (resumen del inicio / `/eventos`).
4. Ver promos de hoy (`/promos`).

Frecuentes:

5. Cargar nafta (`/combustible/nueva`, con y sin varios vehículos).
6. Crear un evento (`/eventos`, diálogo `EventFormDialog`).
7. Cargar un gasto compartido (`/gastos/[id]/nuevo`).
8. Ver quién le debe a quién (`/gastos/[id]/balances`).
9. Subir un documento (`/documentos/nuevo`).
10. Encontrar la cédula de un miembro (`/documentos` con filtros, ficha
    `/config/miembros/[id]`).

Completar con las que surgen del código:

11. Crear una lista de compras nueva (desde plantillas o vacía,
    `/compras/nueva`).
12. Cerrar la compra con el total y registrar la promo usada
    (`/compras/[id]/comprar` → `/promos/usar?compra=`).
13. Registrar la promo usada en una carga de combustible
    (`/promos/usar?carga=`).
14. Registrar un pago entre participantes ("Registrar pago" en balances).
15. Ver un documento por vencer (resumen del inicio, filtro "Por vencer"
    en escritorio).
16. Ver los ahorros del mes con promos (`/promos/ahorros`).
17. Ver el rendimiento del auto (`/combustible/[vehicleId]`).
18. Marcar una tarea como hecha (`/tareas`; hoy fuera del inicio con
    `FEATURES.tareas = false`, se llega por `/config`).
19. Ver las calificaciones de un hijo (`/documentos/calificaciones`).
20. Vincular Telegram (`/config/telegram`), por única vez.

## 3. Recorrido con webapp-testing

Usá la skill `webapp-testing` (Playwright) para recorrer cada tarea:

- **Dos dispositivos**:
  - Celular: 390×844 **con user-agent de teléfono** (por ejemplo el
    dispositivo `iPhone 13` de Playwright, que ya es 390×844).
    Importa: el inicio, `/documentos`, `/eventos`, `/gastos`, `/compras`,
    `/combustible` y `/promos` deciden en el servidor por user-agent
    (`isPhoneRequest` en `lib/device.ts`); con un viewport chico y un
    user-agent de escritorio se mide otra cosa.
  - Escritorio: 1440×900 con user-agent de escritorio.
- **Contá** desde el inicio (`/`) con la sesión iniciada:
  - toques/clics (cada toque que cambia algo; escribir en un campo no
    cuenta como toque, pero anotá cuántos campos hay que llenar),
  - pantallas distintas atravesadas (cambios de URL o diálogos a
    pantalla completa),
  - si el botón principal de cada pantalla se ve sin scroll.
- **Capturas** de cada paso en una carpeta temporal **fuera del repo**
  (el scratchpad de la sesión o un `mktemp -d`), con nombres
  `<nn>-<tarea>-<celular|escritorio>-<paso>.png`. Nunca las agregues al
  repo: pueden mostrar datos de la familia.
- Dónde correr: la app no tiene `.env.local` (las variables viven solo en
  Vercel, ver `CLAUDE.md`), así que lo normal es apuntar a la URL del
  deploy de preview de Vercel o de producción, no a un `npm run dev`
  local. No crees un `.env.local` con valores reales.
- En una sesión en la nube Chromium y la Playwright de Node ya están
  instalados (`require('playwright')`); si los scripts de la skill son
  de Python y `playwright` de Python no está, escribí el recorrido en
  Node con el mismo patrón (esperar `networkidle`, inspeccionar,
  actuar) en vez de instalar otra versión del navegador.
- No dejes basura en los datos: si una tarea crea algo (producto, evento,
  gasto, carga, documento), hacela en la familia de prueba (ver abajo) y
  borralo al final si la app permite borrarlo.

## 4. Criterios

Para cada tarea, marcá cada criterio que no se cumple:

1. **Tareas diarias en ≤ 2 toques desde el inicio** (las 1–4 de la
   lista; para el resto, anotá el número y compará celular contra
   escritorio).
2. **Ninguna pantalla sin salida clara**: botón de volver, tab bar o
   menú lateral visibles; después de guardar, queda claro a dónde se
   vuelve.
3. **Botón principal visible sin scroll** en 390×844, sin quedar tapado
   por el tab bar ni el indicador de inicio (`--nav-total`,
   `FloatingAction`, `StickyBottomBar`).
4. **Acciones destructivas con confirmación** (eliminar lista, gasto,
   carga, documento, participante, promo desactivada, etc.).
5. **La misma acción con el mismo nombre en todos lados** (por ejemplo
   "Cargar combustible" vs "Nueva carga", "Nuevo gasto" vs "Cargar
   gasto"): listá las variantes que encuentres.
6. **Qué tareas ya se resuelven más rápido por el bot de Telegram**
   (`/compra`, `/gasto`, `/nafta`, `/evento`, `/hoy`, `/semana`, botones
   "✓ Hecha" y "Ver agenda del día"; ver Fase 7 en `CLAUDE.md`): contá
   los pasos del bot desde el código de `lib/telegram/flows/` y anotalo.

## 5. Entrega

Una tabla, **ordenada por impacto** (frecuencia de la tarea × toques que
se ahorrarían), con estas columnas:

| Tarea | Toques celular | Toques escritorio | Problema | Propuesta |
| --- | --- | --- | --- | --- |

Debajo de la tabla:

- Rutas huérfanas y nombres inconsistentes encontrados.
- Tareas donde el bot ya gana, y si conviene decirlo en la app.
- Para cada propuesta: si es una mejora mínima (un PR) o algo más grande
  que habría que confirmar, y qué regla de `CLAUDE.md` toca, si toca
  alguna.
- Dónde quedaron las capturas (ruta completa de la carpeta temporal).

**No implementes ningún cambio.** Presentá la tabla y esperá el OK del
usuario, propuesta por propuesta.

## Sesión iniciada: usuario de prueba

Las credenciales van en variables de entorno **locales** de la sesión,
nunca en el repo, en un archivo versionado ni en las capturas:

- `AUDITORIA_EMAIL`
- `AUDITORIA_PASSWORD`
- `AUDITORIA_URL` (URL base: preview de Vercel o producción)

El script entra por `/login` con email y contraseña (`login()` en
`app/(auth)/actions.ts`; Google OAuth no sirve para automatizar).

Si esas variables no existen, **frená y explicale al usuario cómo
crearlo** antes de seguir:

1. En el dashboard de Supabase del proyecto: Authentication → Users →
   "Add user" → "Create new user", con un email que no use nadie (por
   ejemplo un alias `+auditoria` de su Gmail) y una contraseña, tildando
   "Auto Confirm User".
2. Qué familia le toca: el trigger `hogar.handle_new_user()` lo vincula a
   una familia existente **solo si ese email ya está cargado como
   miembro sin cuenta**; si no, le crea una familia nueva y vacía. Lo
   recomendado es la familia nueva: la auditoría crea y borra datos, y
   no debe tocar los de la familia real. En ese caso hay que cargarle
   datos de prueba desde la app (un miembro más, una plantilla y una
   lista, un vehículo con un par de cargas, un grupo de gastos, un
   documento, una tarjeta para ver promos), o algunas tareas no se
   pueden medir.
3. `auth.users` es compartida con otras tres apps del proyecto: el
   usuario de prueba existe para todas. Que el email deje claro que es
   de prueba, y borrarlo al terminar si no se va a volver a usar.
4. Cargar las tres variables exportándolas en la terminal local donde
   corre la sesión, nunca en un `.env` versionado. En una sesión en la
   nube, las variables del entorno se guardan en texto plano y las ve
   cualquiera que use ese entorno: la contraseña de prueba no va ahí.
