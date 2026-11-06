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

## Actores hijos

- Una responsabilidad con ciclo de vida propio (la reproducción, los efectos visuales) es un actor hijo
  invocado con `input`; el padre le reenvía órdenes (`"playback.*": sendTo("playback", ...)`) y recoge su
  `output` al terminar. El hijo informa de hechos al padre con `sendParent`, y el padre los reemite hacia la
  vista con `emit`. Los hijos se detienen solos al salir del estado que los invoca, y con ellos sus
  temporizadores.
- El padre solo guarda lo que necesita fuera del hijo, con nombres que dicen que no son datos vivos
  (`preferredSpeed`, `lastPlayback`, recibidos como `output`); mientras el hijo vive, la vista lee el hijo
  (`usePlayback`, `useStepIdx`, `usePlaybackSpeed`, `useStageFx`) y esos hooks son la única forma de leerlos.
- Todo lo que dependa del tiempo (reproducción, efectos visuales) corre con el mismo reloj (`src/game/clock.ts`):
  pausar lo detiene y la velocidad escala `dt`, así que animaciones y pasos no se desincronizan. Un efecto de
  duración fija sin reloj (o un `setTimeout` en la vista) se salta la pausa y la velocidad.
- Los eventos que envía la UI se tipan como `GameCommand` (`useGameSend`); los hechos de los hijos hacia el
  padre (`step.played`) son internos y no se pueden enviar desde un componente.
- El reloj (`fromCallback`) envía `clock.tick { dt }` con `performance.now()` (monotónico, `dt ≥ 0`); la
  máquina acumula `dt`, pasa el sobrante al paso siguiente y nunca lee la hora. En tests se provee otro reloj (`machine.provide({ actors: { clock } })`).

## Efectos

- Los efectos asíncronos son actores: `fromPromise` para una petición, `fromCallback` para temporizadores
  o suscripciones.
- Los efectos visuales/sonoros se disparan con `emit` y la vista los consume con `actorRef.on(...)`.
  La vista no muta el estado del juego ni usa `setTimeout`: el tiempo de las animaciones lo lleva
  `stageFxMachine` con el reloj compartido, y se detiene con la máquina que lo posee.
- Si un efecto limpia algo que puso otro paso, comprueba que sigue siendo suyo (p. ej. `anim` guarda la clase
  esperada) para no pisar animaciones posteriores.
- La vista no lee el DOM durante el render: las mediciones van en un efecto de layout.
- Las dependencias externas (`queryClient`, etc.) se inyectan con `machine.provide()` (ver `GameProvider`),
  nunca en el contexto.

## UI

- Usar tags tipados (`setup({ types: { tags } })`), `matches()` y `can()` en lugar de booleanos paralelos
  (p. ej. habilitar "Iniciar" con `can({ type: "battle.start", ... })`).

## Tests

- Cada transición nueva, cada guard y cada camino de error llevan un test de la máquina
  (con `vi.useFakeTimers()` y `gameMachine.provide({ actors })`).
- Incluir los casos negativos: eventos que no deben aceptarse en un estado (`can(...) === false`).
- **Cobertura de transiciones** (`test/game/transitions.test.ts`): `@xstate/graph` recorre cada máquina con una lista
  finita de eventos y el test falla si alguna transición declarada no se alcanza. Al añadir un estado o un evento,
  añade el evento a la lista de su máquina (el mensaje indica la transición sin cubrir). El grafo es una transición
  pura: no hay actores vivos ni padre, así que las acciones no deben depender de ellos sin `?.`.
- **UI** (`test/ui/*.test.tsx`, proyecto `ui` de Vitest con `jsdom`): se monta la máquina real con
  `prepareBattle` sustituido y `vi.useFakeTimers()`, y se comprueba lo que pinta cada fase (`test/ui/harness.tsx`).
  No se duplica la lógica de la máquina: se verifica botón habilitado/deshabilitado y la fase resultante.
