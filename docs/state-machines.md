# Máquinas de estado (XState v5)

Reglas para escribir y modificar máquinas del proyecto. La referencia viva es `src/game/machine.ts`
(`gameMachine`) y sus tests en `test/game/machine.test.ts`. Para detalles de la API, usar el skill
`xstate-v5` (y `state-management` para decidir qué estado va en cada sitio).

## Eventos

- Nombres `dominio.verbo` en minúsculas. Espacios de nombres actuales: `battle.*` y `playback.*`.
- Lo que **envía la UI** son órdenes en imperativo (`battle.start`, `playback.pause`).
- Lo que **emite la máquina** (`emit`) son hechos en pasado (`step.played`, `battle.ended`).
  Una orden a la vista disfrazada de evento (p. ej. `clear`) es un error: se emite el hecho que la provoca.
- Los eventos con valor lo llevan explícito (`playback.setSpeed { speed }`), no "alternar".

## Determinismo

- Las transiciones son puras. Nada de `Math.random`, `Date.now` ni `randomSeed()` dentro de acciones o guards.
- La aleatoriedad entra en el payload de un evento o en el `input`, y toda generación usa el `Rng` con
  semilla (`src/game/rng.ts`). Así, una secuencia de eventos reproduce la misma batalla.

## Modos frente a datos

- Las fases son estados, no booleanos ni valores en el contexto. Si hay una partida en curso, existe un
  estado padre que la agrupa (`match`), con un único `battle.exit`.
- El contexto solo guarda datos durables y **serializables** (nada de `Error`, `QueryClient`, funciones).
  Lo derivable se calcula con funciones puras (p. ej. `applyStep` / `deriveBattleViewState`).
- Sin datos de relleno: nada de valores por defecto que parezcan reales. Si algo no existe es `null`, y se
  recupera con un helper `require*` (p. ej. `requireMatch`) que falla de forma visible.
  XState no tipa el contexto según el estado; el helper documenta esa invariante.

## Implementaciones con nombre

- Acciones, guards, actores y delays se declaran en `setup()` y reciben los datos por `params`
  (`{ type: "setMatch", params: ({ event }) => ... }`); no leen `event` directamente ni usan `assertEvent`.
- Guards y acciones con nombre, no en línea, salvo `assign` trivial que ya vive en `setup`.

## Efectos

- Los efectos asíncronos son actores: `fromPromise` para una petición, `fromCallback` para temporizadores
  o suscripciones.
- Los efectos visuales/sonoros se disparan con `emit` y la vista los consume con `actorRef.on(...)`.
  La vista no muta el estado del juego y cancela sus propios temporizadores en `battle.ended`.
- Las dependencias externas (`queryClient`, etc.) se inyectan con `machine.provide()` (ver `GameProvider`),
  nunca en el contexto.

## UI

- Usar tags tipados (`setup({ types: { tags } })`), `matches()` y `can()` en lugar de booleanos paralelos
  (p. ej. habilitar "Iniciar" con `can({ type: "battle.start", ... })`).

## Tests

- Cada transición nueva, cada guard y cada camino de error llevan un test de la máquina
  (con `vi.useFakeTimers()` y `gameMachine.provide({ actors })`).
- Incluir los casos negativos: eventos que no deben aceptarse en un estado (`can(...) === false`).
