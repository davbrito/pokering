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
  fighters: readonly [Fighter, Fighter] | null;
  seed: number | null;
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
export type GameEmitted = { type: "step"; step: BattleStep; stepIdx: number };

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
    nextStep: assign({ stepIdx: ({ context }) => context.stepIdx + 1 }),
    goToLastStep: assign({ stepIdx: ({ context }) => Math.max(0, context.logs.length - 1) }),
    toggleSpeed: assign({
      speed: ({ context }) => SPEEDS[(SPEEDS.indexOf(context.speed) + 1) % SPEEDS.length],
    }),
    emitCurrentStep: emit(({ context }) => ({
      type: "step" as const,
      step: context.logs[context.stepIdx],
      stepIdx: context.stepIdx,
    })),
    resetBattle: assign({ setup: null, logs: [], stepIdx: 0, speed: 1, seed: null, error: null }),
  },
}).createMachine({
  id: "game",
  context: ({ input }) => ({
    queryClient: input.queryClient,
    fighters: null,
    seed: null,
    setup: null,
    logs: [],
    stepIdx: 0,
    speed: 1,
    error: null,
  }),
  initial: "selection",
  states: {
    selection: {
      on: { START: { target: "loading", actions: "prepareFromStart" } },
    },
    loading: {
      invoke: {
        src: "prepareBattle",
        input: ({ context }) => {
          if (!context.fighters || context.seed === null) throw new Error("prepareBattle sin luchadores");
          return { queryClient: context.queryClient, fighters: context.fighters, seed: context.seed };
        },
        onDone: {
          target: "battle",
          actions: assign(({ event }) => ({ setup: event.output.setup, logs: event.output.steps, stepIdx: 0 })),
        },
        onError: { target: "error", actions: assign({ error: ({ event }) => event.error }) },
      },
    },
    battle: {
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
          on: {
            RESUME: "playing",
            TOGGLE_SPEED: { actions: "toggleSpeed" },
          },
        },
      },
    },
    result: {
      on: {
        BACK: { target: "selection", actions: "resetBattle" },
        REMATCH: { target: "loading", actions: "newSeed" },
      },
    },
    error: {
      on: {
        BACK: { target: "selection", actions: "resetBattle" },
        REMATCH: { target: "loading", actions: "newSeed" },
      },
    },
  },
});

export type GameMachine = typeof gameMachine;
