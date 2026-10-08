# SPEC 04 — Integración con Supabase

> **Estado:** Aprobado · **Depende de:** 03-about-page-contact-resend · **Fecha:** 2026-10-08
> **Objetivo:** Conectar la app Next.js al proyecto Supabase existente con clientes de
> browser y servidor, refresco de sesión en `proxy.ts` y un endpoint de salud que
> verifica la conexión.

---

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Usar el proyecto remoto `bbdcjsmdndwagmxzxfqn` (el mismo de `.mcp.json`).
- Crear `lib/supabase/client.ts` — cliente para Client Components (`createBrowserClient`).
- Crear `lib/supabase/server.ts` — cliente para Server Components, Route Handlers y
  Server Actions (`createServerClient` con `cookies()` de `next/headers`).
- Crear `lib/supabase/proxy.ts` — helper `updateSession(request)` que refresca la sesión
  y propaga las cookies actualizadas.
- Crear `proxy.ts` en la raíz — invoca `updateSession` (Next 16 renombró `middleware` a `proxy`).
- Crear `app/api/health/supabase/route.ts` — `GET` que comprueba conectividad con Supabase.
- Variables de entorno: `.env.local` con valores reales y `.env.template` con placeholders.

**Fuera de alcance (para specs futuros):**

- Supabase Auth real: login, registro, logout. `UserContext` (localStorage) y `/auth` no se tocan.
- Tablas, migraciones, RLS y Hall of Fame real. No se crea ningún esquema.
- Tipos TS generados (`database.ts`): sin tablas no hay qué tipar.
- Protección de rutas o redirects por sesión en `proxy.ts`.
- Supabase local (CLI + Docker), Storage, Realtime y Edge Functions.

---

## Data model

No se introduce ningún modelo de datos. No hay tablas ni cambios de esquema.

- **Variables de entorno:**
  - `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto (`https://bbdcjsmdndwagmxzxfqn.supabase.co`).
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key del proyecto. Es pública por diseño.
- **Respuesta del health endpoint** — `{ ok: true }` con `200`, o
  `{ ok: false, error: string }` con `503`.

Convención: la service role / secret key **no** se usa ni se guarda en este spec.

---

## Implementation plan

1. **Instalar paquetes** — `npm install @supabase/supabase-js @supabase/ssr`.
   Verificación: ambos aparecen en `dependencies` de `package.json`.

2. **Configurar variables de entorno** — obtener URL y anon key con las tools MCP
   `get_project_url` y `get_publishable_keys`. Escribirlas en `.env.local` y añadir
   las dos claves con placeholders `XXXXX` a `.env.template`.
   Verificación: `.env.local` existe, está ignorado por git y `.env.template` lista las claves.

3. **Crear `lib/supabase/client.ts`** — exporta `createClient()` con `createBrowserClient`.
   Verificación: `npx tsc --noEmit` sin errores.

4. **Crear `lib/supabase/server.ts`** — exporta `async createClient()` con `createServerClient`
   y handlers `getAll`/`setAll` sobre `await cookies()`. Leer antes la guía de `cookies`
   en `node_modules/next/dist/docs/` (API asíncrona en esta versión).
   Verificación: `npx tsc --noEmit` sin errores.

5. **Crear `lib/supabase/proxy.ts` y `proxy.ts`** — `updateSession(request)` crea un
   `createServerClient` sobre la request/response, llama a `supabase.auth.getClaims()` y devuelve la
   respuesta con cookies actualizadas. `proxy.ts` exporta `proxy` y `config.matcher`
   que excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes.
   Verificación: `npm run dev` arranca sin errores y `/`, `/games`, `/about` siguen cargando.

6. **Crear `app/api/health/supabase/route.ts`** — `GET` que hace `fetch` a
   `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` con el header `apikey`; devuelve
   `200 { ok: true }` si responde OK, `503 { ok: false, error }` si falla o faltan env vars.
   Verificación: `curl http://localhost:3000/api/health/supabase` retorna `{"ok":true}`.

---

## Acceptance criteria

**Dependencias y entorno**

- [ ] `@supabase/supabase-js` y `@supabase/ssr` están en `package.json`.
- [ ] `.env.local` define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] `.env.template` lista ambas claves con placeholder y `.env.local` no aparece en `git status`.
- [ ] Ningún secret (service role / secret key) existe en el repo.

**Clientes y proxy**

- [ ] Existen `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/proxy.ts`.
- [ ] Existe `proxy.ts` en la raíz y no existe `middleware.ts`.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npm run build` termina sin errores.
- [ ] `/`, `/games`, `/about` y `/auth` cargan sin errores de consola tras añadir el proxy.

**Health endpoint**

- [ ] `GET /api/health/supabase` con env vars válidas devuelve `200 { "ok": true }`.
- [ ] Con `NEXT_PUBLIC_SUPABASE_URL` ausente devuelve `503` con `ok: false` y un `error`.

**No regresión**

- [ ] `UserContext` y `app/auth/page.tsx` no fueron modificados.
- [ ] `POST /api/contact` sigue funcionando igual.

---

## Decisions

- **Sí:** Usar el proyecto remoto existente. Ya está ligado vía `.mcp.json`; no requiere Docker.
- **Sí:** `@supabase/ssr` + `proxy.ts`. Es el patrón oficial para App Router y deja la base
  lista para Auth sin reescribir clientes.
- **Sí:** `proxy.ts` y no `middleware.ts`. En Next 16 `middleware` está deprecado.
- **Sí:** `getClaims()` en el proxy en lugar de `getSession()`. Valida el JWT; `getSession()`
  en servidor no es confiable.
- **Sí:** Clientes en `lib/supabase/`. Es la carpeta convencional; `lib/` aún no existe y se crea aquí.
- **Sí:** Health endpoint vía `/auth/v1/health`. Verifica red, URL y key sin necesitar tablas.
- **Sí:** Anon key en `NEXT_PUBLIC_*`. Es pública por diseño; la seguridad la dará RLS en specs futuros.
- **No:** Auth real en este spec. Reemplazar `UserContext` es un cambio de UX y datos que merece su spec.
- **No:** Tablas / migraciones / tipos generados. Se definen cuando haya una feature que los use.
- **No:** Supabase local. Añade Docker y CLI sin beneficio para esta integración.

---

## Risks

| Riesgo                                                    | Mitigación                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| API de `proxy`/`cookies` difiere de lo conocido (Next 16) | Leer `node_modules/next/dist/docs/` antes de escribir (regla de AGENTS.md).       |
| Proxy corre en cada request y añade latencia              | `matcher` excluye estáticos; `getClaims()` evita llamada de red con claves asimétricas. |
| Env vars ausentes rompen el arranque                      | Los clientes fallan con error claro; el health endpoint devuelve `503`.           |
| Proyecto pausado (plan gratuito)                          | El health endpoint lo detecta con `503`; reactivar desde el dashboard.            |

---

## What is **not** in this spec

- Login, registro, logout ni sesión de usuario real.
- Tablas, RLS, migraciones o tipos generados.
- Scores reales ni Hall of Fame conectado.
- Supabase local, Storage, Realtime o Edge Functions.
- Protección de rutas.

Cada uno, si se hace, va en su propio spec.
