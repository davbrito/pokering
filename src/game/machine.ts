import { assign, enqueueActions, fromPromise, setup } from "xstate";
import { stepDuration } from "./battle-state";
import type { Fighter, PrepareBattleInput, PreparedBattle } from "./prepare-battle";
import type { BattleStep } from "./types";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/** Velocidad siguiente en el ciclo 1x → 2x → 4x → 1x (la UI lo usa para enviar `playback.setSpeed`). */
export function nextSpeed(speed: Speed): Speed {
  return SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
}

export type Fighters = readonly [Fighter, Fighter];

/** Qué batalla se carga/reproduce. La semilla viaja en el evento: la máquina no genera azar. */
export type Match = PrepareBattleInput;

export interface GameContext {
  match: Match | null;
  prepared: PreparedBattle | null;
  stepIdx: number;
  speed: Speed;
  /** Serializable para `getPersistedSnapshot()`. */
  error: { message: string } | null;
}

/** Órdenes que envía la UI (imperativo, `dominio.verbo`). */
export type GameEvent =
  | { type: "battle.start"; fighters: Fighters; seed: number }
  /** Mismos luchadores, semilla nueva (solo desde `result`). */
  | { type: "battle.rematch"; seed: number }
  /** Reintenta la carga con la misma semilla (solo desde `error`). */
  | { type: "battle.retry" }
  | { type: "battle.exit" }
  | { type: "playback.pause" }
  | { type: "playback.resume" }
  | { type: "playback.setSpeed"; speed: Speed }
  | { type: "playback.skip" };

/** Hechos que emite la máquina (pasado) para efectos visuales/sonoros. */
export type GameEmitted = { type: "step.played"; step: BattleStep; stepIdx: number } | { type: "battle.ended" };

export type GameTag = "selection" | "loading" | "battle" | "paused" | "result" | "error";

export const INTRO_DELAY_MS = 400;

/** Dentro de `match` el contexto siempre tiene `match`; XState no tipa el contexto por estado. */
export function requireMatch(context: GameContext): Match {
  if (!context.match) throw new Error("invariant: no hay batalla en curso (context.match es null)");
  return context.match;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    emitted: {} as GameEmitted,
    tags: {} as GameTag,
  },
  actors: {
    // Implementación a proveer con `gameMachine.provide(...)` (inyecta el queryClient; ver GameProvider).
    prepareBattle: fromPromise<PreparedBattle, PrepareBattleInput>(async () => {
      throw new Error("prepareBattle no fue provisto");
    }),
  },
  delays: {
    stepDelay: ({ context }) => {
      const step = context.prepared?.steps[context.stepIdx];
      return step ? stepDuration(step) / context.speed : 0;
    },
    introDelay: INTRO_DELAY_MS,
  },
  guards: {
    hasSteps: (_, params: { steps: readonly BattleStep[] }) => params.steps.length > 0,
    isLastStep: ({ context }) => context.stepIdx >= (context.prepared?.steps.length ?? 0) - 1,
  },
  actions: {
    // Todo entra por `params`; ninguna acción lee `event` ni genera aleatoriedad.
    setMatch: assign((_, params: Match) => ({ match: { fighters: params.fighters, seed: params.seed } })),
    setSeed: assign(({ context }, params: { seed: number }) => ({
      match: context.match && { ...context.match, seed: params.seed },
    })),
    resetRun: assign({ prepared: null, stepIdx: 0, error: null }),
    clearMatch: assign({ match: null, prepared: null, stepIdx: 0, speed: 1, error: null }),
    setPrepared: assign((_, params: PreparedBattle) => ({ prepared: params, stepIdx: 0 })),
    setError: assign((_, params: { message: string }) => ({ error: { message: params.message } })),
    setSpeed: assign((_, params: { speed: Speed }) => ({ speed: params.speed })),
    nextStep: assign({ stepIdx: ({ context }) => context.stepIdx + 1 }),
    goToLastStep: assign({ stepIdx: ({ context }) => Math.max(0, (context.prepared?.steps.length ?? 0) - 1) }),
    emitStepPlayed: enqueueActions(({ context, enqueue }) => {
      const step = context.prepared?.steps[context.stepIdx];
      if (step) enqueue.emit({ type: "step.played", step, stepIdx: context.stepIdx });
    }),
    emitBattleEnded: enqueueActions(({ enqueue }) => enqueue.emit({ type: "battle.ended" })),
  },
}).createMachine({
  id: "game",
  initial: "selection",
  context: { match: null, prepared: null, stepIdx: 0, speed: 1, error: null },
  states: {
    selection: {
      tags: ["selection"],
      on: {
        "battle.start": {
          target: "match",
          actions: { type: "setMatch", params: ({ event }) => ({ fighters: event.fighters, seed: event.seed }) },
        },
      },
    },
    // Hay una partida en curso: un único `battle.exit` sirve para todos sus subestados.
    match: {
      initial: "loading",
      on: { "battle.exit": { target: "selection", actions: "clearMatch" } },
      states: {
        loading: {
          tags: ["loading"],
          entry: "resetRun", // sin datos de la batalla anterior
          // Salir de `match` cancela el `invoke`: el usuario nunca queda atascado si la API tarda.
          invoke: {
            id: "prepareBattle",
            src: "prepareBattle",
            input: ({ context }) => requireMatch(context),
            onDone: [
              {
                guard: { type: "hasSteps", params: ({ event }) => ({ steps: event.output.steps }) },
                target: "playback",
                actions: { type: "setPrepared", params: ({ event }) => event.output },
              },
              // Una batalla sin pasos es un error de generación: no hay nada que reproducir.
              { target: "error", actions: { type: "setError", params: () => ({ message: "empty battle" }) } },
            ],
            onError: {
              target: "error",
              actions: { type: "setError", params: ({ event }) => ({ message: errorMessage(event.error) }) },
            },
          },
        },
        playback: {
          tags: ["battle"],
          initial: "intro",
          // Cubre fin normal, `playback.skip` y `battle.exit`: la vista limpia sus efectos.
          exit: "emitBattleEnded",
          on: {
            "playback.skip": { target: "result", actions: "goToLastStep" },
            // Valor explícito e idempotente; también válido en `intro` y `paused` (sin reiniciar nada).
            "playback.setSpeed": { actions: { type: "setSpeed", params: ({ event }) => ({ speed: event.speed }) } },
          },
          states: {
            intro: {
              after: { introDelay: { target: "playing", actions: "emitStepPlayed" } },
            },
            playing: {
              after: {
                stepDelay: [
                  { guard: "isLastStep", target: "#game.match.result" },
                  { target: "playing", reenter: true, actions: ["nextStep", "emitStepPlayed"] },
                ],
              },
              on: {
                "playback.pause": "paused",
                "playback.setSpeed": {
                  target: "playing",
                  reenter: true,
                  actions: { type: "setSpeed", params: ({ event }) => ({ speed: event.speed }) },
                },
              },
            },
            paused: {
              tags: ["paused"],
              on: { "playback.resume": "playing" },
            },
          },
        },
        result: {
          tags: ["result"],
          on: {
            "battle.rematch": {
              target: "loading",
              actions: { type: "setSeed", params: ({ event }) => ({ seed: event.seed }) },
            },
            "battle.start": {
              target: "loading",
              actions: { type: "setMatch", params: ({ event }) => ({ fighters: event.fighters, seed: event.seed }) },
            },
          },
        },
        error: {
          tags: ["error"],
          on: {
            "battle.retry": "loading", // misma semilla
            "battle.start": {
              target: "loading",
              actions: { type: "setMatch", params: ({ event }) => ({ fighters: event.fighters, seed: event.seed }) },
            },
          },
        },
      },
    },
  },
});

export type GameMachine = typeof gameMachine;
