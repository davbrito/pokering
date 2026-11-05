import type { QueryClient } from "@tanstack/react-query";
import { assertEvent, assign, emit, fromPromise, setup } from "xstate";
import { type BattleSetup, stepDuration } from "./battle-state";
import { type Fighter, type PrepareBattleInput, type PreparedBattle, prepareBattle } from "./prepare-battle";
import { randomSeed } from "./rng";
import type { BattleStep } from "./types";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface GameContext {
  queryClient: QueryClient;
  /** Luchadores de la batalla en curso. Hasta el primer `START` son valores por defecto sin significado. */
  fighters: readonly [Fighter, Fighter];
  seed: number;
  setup: BattleSetup | null;
  logs: BattleStep[];
  stepIdx: number;
  speed: Speed;
  error: unknown;
}

export interface GameInput {
  queryClient: QueryClient;
}

export type GameEvent =
  | { type: "START"; fighters: readonly [Fighter, Fighter]; seed?: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "TOGGLE_SPEED" }
  | { type: "SKIP" }
  | { type: "BACK" }
  | { type: "REMATCH" };

/** Emitido cada vez que un paso entra en escena, para disparar efectos visuales/sonoros. */
export type GameEmitted = { type: "step"; step: BattleStep; stepIdx: number } | { type: "clear" };

const DEFAULT_FIGHTERS: readonly [Fighter, Fighter] = [
  { id: 1, level: 50 },
  { id: 4, level: 50 },
];

export const INTRO_DELAY_MS = 400;

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as GameInput,
    emitted: {} as GameEmitted,
  },
  actors: {
    prepareBattle: fromPromise<PreparedBattle, PrepareBattleInput>(({ input }) => prepareBattle(input)),
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
  },
  actions: {
    prepareFromStart: assign(({ event }) => {
      assertEvent(event, "START");
      return { fighters: event.fighters, seed: event.seed ?? randomSeed(), error: null };
    }),
    newSeed: assign({ seed: () => randomSeed(), error: () => null }),
    storeBattle: assign((_, params: PreparedBattle) => ({ setup: params.setup, logs: params.steps, stepIdx: 0 })),
    storeError: assign((_, params: { error: unknown }) => ({ error: params.error })),
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
    resetBattle: assign({ setup: null, logs: [], stepIdx: 0, speed: 1, error: null }),
  },
}).createMachine({
  id: "game",
  context: ({ input }) => ({
    queryClient: input.queryClient,
    fighters: DEFAULT_FIGHTERS,
    seed: 0,
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
      on: { START: { target: "loading", actions: "prepareFromStart" } },
    },
    loading: {
      tags: ["loading"],
      entry: "emitClear",
      invoke: {
        id: "prepareBattle",
        src: "prepareBattle",
        input: ({ context }) => ({
          queryClient: context.queryClient,
          fighters: context.fighters,
          seed: context.seed,
        }),
        onDone: {
          target: "battle",
          actions: { type: "storeBattle", params: ({ event }) => event.output },
        },
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
        REMATCH: { target: "loading", actions: "newSeed" },
      },
    },
    error: {
      tags: ["error"],
      on: {
        BACK: { target: "selection", actions: "resetBattle" },
        REMATCH: { target: "loading", actions: "newSeed" },
      },
    },
  },
});

export type GameMachine = typeof gameMachine;
