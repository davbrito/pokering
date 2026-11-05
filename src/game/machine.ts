import { assign, emit, fromPromise, setup } from "xstate";
import { type BattleSetup, stepDuration } from "./battle-state";
import type { Fighter, PrepareBattleInput, PreparedBattle } from "./prepare-battle";
import type { BattleStep } from "./types";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface GameContext {
  /** Qué batalla se carga/reproduce (luchadores + semilla). `null` mientras no hay batalla. */
  request: PrepareBattleInput | null;
  setup: BattleSetup | null;
  logs: BattleStep[];
  stepIdx: number;
  speed: Speed;
  /** Mensaje del último fallo de carga (string: el snapshot sigue siendo serializable). */
  error: string | null;
}

export type GameEvent =
  /** La semilla viaja en el evento: la máquina no genera azar, así que los eventos reproducen la batalla. */
  | { type: "START"; fighters: readonly [Fighter, Fighter]; seed: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "TOGGLE_SPEED" }
  | { type: "SKIP" }
  | { type: "BACK" }
  /** Revancha con los mismos luchadores y una semilla nueva (solo desde `result`). */
  | { type: "REMATCH"; seed: number }
  /** Reintenta la carga con la misma batalla (solo desde `error`). */
  | { type: "RETRY" };

/** Emitido cada vez que un paso entra en escena, para disparar efectos visuales/sonoros. */
export type GameEmitted = { type: "step"; step: BattleStep; stepIdx: number } | { type: "clear" };

export const INTRO_DELAY_MS = 400;

const startTransition = {
  target: "loading",
  actions: {
    type: "setRequest",
    params: ({ event }: { event: Extract<GameEvent, { type: "START" }> }) => ({
      fighters: event.fighters,
      seed: event.seed,
    }),
  },
} as const;

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    emitted: {} as GameEmitted,
  },
  actors: {
    // Implementación a proveer con `gameMachine.provide(...)` (inyecta el queryClient; ver GameProvider).
    prepareBattle: fromPromise<PreparedBattle, PrepareBattleInput | null>(async () => {
      throw new Error("prepareBattle no fue provisto");
    }),
  },
  delays: {
    stepDelay: ({ context }) => {
      const step = context.logs[context.stepIdx];
      return step ? stepDuration(step) / context.speed : 0;
    },
    introDelay: INTRO_DELAY_MS,
  },
  guards: {
    isLastStep: ({ context }) => context.stepIdx >= context.logs.length - 1,
    hasSteps: (_, params: PreparedBattle) => params.steps.length > 0,
  },
  actions: {
    setRequest: assign((_, params: PrepareBattleInput) => ({ request: params })),
    withNewSeed: assign(({ context }, params: { seed: number }) => ({
      request: context.request && { ...context.request, seed: params.seed },
    })),
    clearBattleData: assign({ setup: null, logs: [], stepIdx: 0, speed: 1, error: null }),
    storeBattle: assign((_, params: PreparedBattle) => ({ setup: params.setup, logs: params.steps, stepIdx: 0 })),
    storeError: assign((_, params: { error: unknown }) => ({
      error: params.error instanceof Error ? params.error.message : String(params.error),
    })),
    nextStep: assign({ stepIdx: ({ context }) => context.stepIdx + 1 }),
    goToLastStep: assign({ stepIdx: ({ context }) => Math.max(0, context.logs.length - 1) }),
    toggleSpeed: assign({
      speed: ({ context }) => SPEEDS[(SPEEDS.indexOf(context.speed) + 1) % SPEEDS.length],
    }),
    emitClear: emit({ type: "clear" as const }),
    emitCurrentStep: emit(({ context }) => ({
      type: "step" as const,
      step: context.logs[context.stepIdx],
      stepIdx: context.stepIdx,
    })),
    resetBattle: assign({ request: null, setup: null, logs: [], stepIdx: 0, speed: 1, error: null }),
  },
}).createMachine({
  id: "game",
  context: () => ({
    request: null,
    setup: null,
    logs: [],
    stepIdx: 0,
    speed: 1,
    error: null,
  }),
  initial: "selection",
  states: {
    selection: {
      tags: ["selection"],
      on: { START: startTransition },
    },
    loading: {
      tags: ["loading"],
      entry: ["clearBattleData", "emitClear"],
      // Salir del estado cancela el `invoke`: el usuario nunca queda atascado si la API tarda.
      on: { BACK: { target: "selection", actions: "resetBattle" } },
      invoke: {
        id: "prepareBattle",
        src: "prepareBattle",
        input: ({ context }) => context.request,
        onDone: [
          {
            guard: { type: "hasSteps", params: ({ event }) => event.output },
            target: "battle",
            actions: { type: "storeBattle", params: ({ event }) => event.output },
          },
          // Una batalla sin pasos es un error de generación: no hay nada que reproducir.
          { target: "error", actions: { type: "storeError", params: () => ({ error: new Error("empty battle") }) } },
        ],
        onError: {
          target: "error",
          actions: { type: "storeError", params: ({ event }) => ({ error: event.error }) },
        },
      },
    },
    battle: {
      tags: ["battle"],
      initial: "intro",
      on: {
        SKIP: { target: "result", actions: "goToLastStep" },
        BACK: { target: "#game.selection", actions: ["resetBattle", "emitClear"] },
      },
      states: {
        intro: {
          after: { introDelay: { target: "playing", actions: "emitCurrentStep" } },
        },
        playing: {
          after: {
            stepDelay: [
              { guard: "isLastStep", target: "#game.result" },
              { target: "playing", reenter: true, actions: ["nextStep", "emitCurrentStep"] },
            ],
          },
          on: {
            PAUSE: "paused",
            TOGGLE_SPEED: { target: "playing", reenter: true, actions: "toggleSpeed" },
          },
        },
        paused: {
          tags: ["paused"],
          on: {
            RESUME: "playing",
            TOGGLE_SPEED: { actions: "toggleSpeed" },
          },
        },
      },
    },
    result: {
      tags: ["result"],
      entry: "emitClear",
      on: {
        BACK: { target: "selection", actions: "resetBattle" },
        START: startTransition,
        REMATCH: {
          target: "loading",
          actions: { type: "withNewSeed", params: ({ event }) => ({ seed: event.seed }) },
        },
      },
    },
    error: {
      tags: ["error"],
      on: {
        BACK: { target: "selection", actions: "resetBattle" },
        START: startTransition,
        RETRY: "loading",
      },
    },
  },
});

export type GameMachine = typeof gameMachine;
