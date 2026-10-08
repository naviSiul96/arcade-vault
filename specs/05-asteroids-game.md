# SPEC 05 — Juego Asteroids en la plataforma

> **Estado:** Aprobado · **Depende de:** 01-mvp-visual-screens, 04-supabase-integration · **Fecha:** 2026-10-08
> **Objetivo:** Portar el juego Asteroids de `references/started-games/02-asteroids` a TypeScript como motor canvas que notifica score, vidas, nivel y game over al HUD React de `/games/rocas/play`.

---

## Scope

**In:**

- Portar a TypeScript toda la lógica existente de `game.js`: nave (rotación, empuje, arrastre, disparo con cooldown, invencibilidad con parpadeo), balas, asteroides de 3 tamaños con división, partículas, power-up de triple disparo, niveles progresivos, 3 vidas, wrap toroidal y colisiones.
- Motor en `lib/games/asteroids/` sin dependencias de React ni de globals: una clase `AsteroidsGame` que recibe el `canvas` y callbacks.
- Componente client `components/games/AsteroidsCanvas.tsx` que monta el motor en `useEffect`, lo destruye al desmontar y expone `pause`, `resume`, `restart` y `end` vía `ref`.
- El canvas solo dibuja el mundo (fondo, nave, asteroides, balas, partículas, power-ups). **No** dibuja HUD ni overlay de Game Over: eso lo pinta React.
- Integrar en `app/games/[id]/play/page.tsx`: si `id === 'rocas'` se usa `AsteroidsCanvas` dentro de `.crt-screen` y el HUD (jugador, puntuación, vidas, nivel) muestra los valores reales del motor.
- Botones existentes: PAUSA/REANUDAR pausa el motor, FIN dispara game over, "JUGAR DE NUEVO" reinicia el motor.
- El modal "FIN DEL JUEGO" aparece cuando el motor emite `onGameOver` (vidas = 0) o al pulsar FIN, con la puntuación real.
- Visual original: vectorial blanco sobre negro, canvas lógico 800×600 escalado por CSS al ancho disponible manteniendo 4:3.
- Teclado: `←` `→` rotar, `↑` propulsar, `Espacio` disparar. `preventDefault` sobre esas teclas mientras el juego está montado, para evitar scroll de página.
- Los otros 5 juegos del catálogo mantienen la simulación actual.
- `references/started-games/02-asteroids/` es solo de lectura: el port es código nuevo en `lib/games/asteroids/` y `components/games/`. Ningún archivo de esa carpeta se modifica, mueve ni borra.

**Fuera de alcance (para specs futuros):**

- Controles táctiles / versión móvil.
- Sonido y música.
- OVNIs (mencionados en la descripción de `rocas`, no existen en el juego original).
- Persistir la puntuación (Supabase, tablas, Hall of Fame real). "GUARDAR PUNTUACIÓN" sigue siendo solo estado local.
- Recolorear el juego con la paleta neón.
- Portar los demás juegos de `references/started-games/`.
- Tests automatizados (no hay runner configurado).

---

## Data model

Estructuras nuevas, solo en memoria. No hay persistencia.

```ts
// lib/games/asteroids/types.ts
export type GameStatus = 'playing' | 'dead' | 'gameover';

export interface AsteroidsCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  end: () => void; // fuerza game over (botón FIN)
}
```

Convenciones:

- Canvas lógico 800×600, origen arriba-izquierda. Constantes `W` y `H` exportadas desde `lib/games/asteroids/constants.ts`.
- Velocidades en px/s, ángulos en radianes, `dt` en segundos y limitado a 0.05 s (igual que el original).
- Tamaños de asteroide: 1 pequeño, 2 mediano, 3 grande. `RADII`, `SPEEDS` y `POINTS` indexados por tamaño, con los mismos valores que `game.js` (puntos 100 / 50 / 20).
- Los callbacks se invocan solo cuando el valor cambia, no en cada frame.
- Estado del juego (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `status`) pasa de globals a campos privados de `AsteroidsGame`.

Estructura de archivos:

```
lib/games/asteroids/
  constants.ts      // W, H, RADII, SPEEDS, POINTS, power-up
  utils.ts          // wrap, dist, rand, randInt
  entities.ts       // Bullet, Asteroid, PowerUp, Ship, Particle
  AsteroidsGame.ts  // loop, input, update, draw, callbacks
  types.ts
components/games/AsteroidsCanvas.tsx
```

---

## Implementation plan

1. **Constantes, utils y tipos** — crear `constants.ts`, `utils.ts` y `types.ts` con los valores de `game.js`.
   Verificación: `npx tsc --noEmit` sin errores.

2. **Entidades** — crear `entities.ts` con `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle`. Cada una recibe `ctx` y el estado de teclas por parámetro en lugar de usar globals.
   Verificación: `npx tsc --noEmit` sin errores.

3. **Motor `AsteroidsGame`** — crear `AsteroidsGame.ts`: input con `keydown`/`keyup`, loop con `requestAnimationFrame`, `update`, `draw` (sin HUD ni overlay), `pause`/`resume`/`restart`/`end` y callbacks. Método `destroy()` que cancela el loop y quita los listeners.
   Verificación: `npx tsc --noEmit` sin errores.

4. **Componente `AsteroidsCanvas`** — `"use client"`, crea el motor en `useEffect`, lo destruye al desmontar y expone `AsteroidsHandle` con `forwardRef` + `useImperativeHandle`. Canvas con `width=800 height=600` y CSS `width: 100%; height: auto`.
   Verificación: montado de forma aislada, se ve la nave y los asteroides moviéndose sin errores de consola.

5. **Integración en `/games/[id]/play`** — para `id === 'rocas'`, reemplazar el contenido de `.game-arena` por `AsteroidsCanvas`, eliminar el `setInterval` de puntuación simulada solo para ese juego, y conectar `onScore`/`onLives`/`onLevel`/`onGameOver` a los estados del HUD. Conectar PAUSA, FIN y JUGAR DE NUEVO al `ref`. Las vidas dejan de estar fijas en 3.
   Verificación: `/games/rocas/play` muestra el juego jugable y el HUD refleja score, vidas y nivel reales; `/games/caida/play` sigue con la simulación.

6. **Ajustes de teclado y foco** — `preventDefault` en flechas y espacio mientras el motor está montado; pausar automáticamente cuando el modal de Game Over está abierto.
   Verificación: jugar con flechas y espacio no hace scroll en la página.

---

## Acceptance criteria

**Juego**

- [ ] `/games/rocas/play` carga sin errores en consola y muestra la nave en el centro con asteroides alrededor.
- [ ] `←` `→` rotan la nave, `↑` la propulsa y `Espacio` dispara con cooldown de 0.2 s.
- [ ] Los bordes del canvas son toroidales para nave, balas, asteroides y power-ups.
- [ ] Un asteroide grande destruido da 20 puntos, uno mediano 50 y uno pequeño 100.
- [ ] Un asteroide grande se parte en 2 medianos, un mediano en 2 pequeños, un pequeño no se parte.
- [ ] El power-up "3x" aparece, se recoge al tocarlo y dispara 3 balas durante 5 s.
- [ ] Al chocar la nave pierde una vida, reaparece tras 2 s con 3 s de invencibilidad parpadeante.
- [ ] Al destruir todos los asteroides se pasa al nivel siguiente con `3 + nivel` asteroides.

**Notificación a React**

- [ ] El HUD muestra la puntuación real y se actualiza al destruir asteroides.
- [ ] El HUD muestra las vidas reales y baja de 3 a 2 al perder una.
- [ ] El HUD muestra el nivel real y sube al completar un nivel.
- [ ] Con 0 vidas aparece el modal "FIN DEL JUEGO" con la puntuación final correcta.
- [ ] El canvas no dibuja SCORE, NIVEL, vidas ni texto "GAME OVER".

**Controles de la plataforma**

- [ ] PAUSA detiene el juego, muestra "EN PAUSA" y REANUDAR continúa sin saltos de movimiento.
- [ ] FIN abre el modal con la puntuación actual.
- [ ] JUGAR DE NUEVO reinicia en puntuación 0, 3 vidas y nivel 01.
- [ ] Jugar con flechas y espacio no hace scroll de la página.

**Ciclo de vida y no regresión**

- [ ] Al salir de la página no queda el loop ni los listeners de teclado activos (sin errores al navegar a `/games`).
- [ ] `/games/caida/play` y los demás juegos siguen con la simulación actual.
- [ ] `git status` no muestra cambios dentro de `references/started-games/02-asteroids/`.
- [ ] `references/started-games/02-asteroids/index.html` sigue abriéndose y funcionando por sí solo.
- [ ] `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] El canvas escala sin deformarse en un viewport de 375 px de ancho.

---

## Decisions

- **Sí:** Port a TypeScript con motor separado del componente. Permite conectar HUD y controles de la plataforma y deja una plantilla para portar los demás juegos.
- **Sí:** Dejar intacto `references/started-games/02-asteroids/`. Es el original de referencia; el port se escribe aparte y la carpeta sirve para comparar comportamiento.
- **No:** `iframe` a HTML estático. No permite comunicar score ni pausa sin `postMessage`.
- **No:** Copiar `game.js` dentro de un `useEffect`. Globals y un solo archivo de 500 líneas, difícil de tipar y mantener.
- **Sí:** El canvas notifica y React pinta el HUD. Evita duplicar información y mantiene consistente el look de la plataforma.
- **Sí:** Callbacks solo cuando el valor cambia. Evita re-renders de React a 60 fps.
- **Sí:** Reutilizar la entrada `rocas` del catálogo. Ya existe con su portada y descripción; crear otra la duplicaría.
- **Sí:** Visual vectorial blanco original. Es fiel al clásico y el marco CRT ya aporta el look neón.
- **No:** Recolorear con paleta neón. Es una decisión de diseño aparte (`/frontend-design`).
- **Sí:** Guardar puntuación sigue como estado local. No hay tablas y persistir requiere su propio spec (esquema + RLS + auth).
- **No:** Controles táctiles, sonido y OVNIs. Cada uno se evalúa en su propio spec.
- **Sí:** Motor y componente en `lib/games/asteroids/` y `components/games/`. Sigue la convención de `lib/` (SPEC 04) y `components/` del proyecto.

---

## Risks

| Riesgo                                                                | Mitigación                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| React StrictMode monta el efecto dos veces y duplica loop/listeners   | `destroy()` cancela `requestAnimationFrame` y quita listeners en el cleanup del `useEffect`.        |
| El juego pierde el foco o la pestaña queda en segundo plano           | `dt` limitado a 0.05 s, igual que el original; evita saltos al volver.                              |
| Flechas y espacio provocan scroll de la página                        | `preventDefault` en esas teclas mientras el motor está montado.                                     |
| Re-renders de React por actualizar score en cada frame                | Callbacks solo cuando cambia el valor.                                                              |
| `play/page.tsx` es un componente client con lógica de simulación      | La rama de `rocas` se aísla en su propio componente para no mezclar estados con los demás juegos.   |
| La API de App Router difiere de lo conocido (Next 16)                 | Leer `node_modules/next/dist/docs/` antes de tocar `app/games/[id]/play/page.tsx` (regla de AGENTS.md). |

---

## What is **not** in this spec

- Controles táctiles ni versión móvil.
- Sonido o música.
- OVNIs ni nuevos power-ups.
- Persistencia de puntuaciones, Supabase o Hall of Fame real.
- Recolorear el juego con la paleta neón.
- Portar otros juegos de `references/started-games/`.
- Modificar, mover o borrar `references/started-games/02-asteroids/`.

Cada uno, si se hace, va en su propio spec.
