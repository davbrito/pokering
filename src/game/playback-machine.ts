import { assign, enqueueActions, setup } from "xstate";
import { stepDuration } from "./battle-state";
import type { BattleStep } from "./types";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/** Velocidad siguiente en el ciclo 1x → 2x → 4x → 1x (la UI lo usa para enviar `playback.setSpeed`). */
export function nextSpeed(speed: Speed): Speed {
  return SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
}

export const INTRO_DELAY_MS = 400;

export interface PlaybackInput {
  steps: readonly BattleStep[];
  speed: Speed;
}

export interface PlaybackContext {
  steps: readonly BattleStep[];
  stepIdx: number;
  speed: Speed;
}

/** Lo que el hijo entrega al padre al terminar (fin normal o `playback.skip`). */
export interface PlaybackOutput {
  speed: Speed;
  stepIdx: number;
}

/** Órdenes que recibe el actor de reproducción (el padre reenvía todo `playback.*`). */
export type PlaybackEvent =
  | { type: "playback.pause" }
  | { type: "playback.resume" }
  | { type: "playback.setSpeed"; speed: Speed }
  | { type: "playback.skip" };

/** Hecho que el hijo envía al padre cuando un paso entra en escena. */
export type StepPlayedEvent = { type: "step.played"; step: BattleStep; stepIdx: number; speed: Speed };

export const playbackMachine = setup({
  types: {
    context: {} as PlaybackContext,
    events: {} as PlaybackEvent,
    input: {} as PlaybackInput,
    output: {} as PlaybackOutput,
    tags: {} as "paused",
  },
  delays: {
    introDelay: INTRO_DELAY_MS,
    stepDelay: ({ context }) => {
      const step = context.steps[context.stepIdx];
      return step ? stepDuration(step) / context.speed : 0;
    },
  },
  guards: {
    isLastStep: ({ context }) => context.stepIdx >= context.steps.length - 1,
  },
  actions: {
    setSpeed: assign((_, params: { speed: Speed }) => ({ speed: params.speed })),
    nextStep: assign({ stepIdx: ({ context }) => context.stepIdx + 1 }),
    goToLastStep: assign({ stepIdx: ({ context }) => Math.max(0, context.steps.length - 1) }),
    sendStepPlayed: enqueueActions(({ context, enqueue }) => {
      const step = context.steps[context.stepIdx];
      if (!step) return;
      const event: StepPlayedEvent = { type: "step.played", step, stepIdx: context.stepIdx, speed: context.speed };
      enqueue.sendParent(event);
    }),
  },
}).createMachine({
  id: "playback",
  initial: "intro",
  context: ({ input }) => ({ steps: input.steps, stepIdx: 0, speed: input.speed }),
  output: ({ context }) => ({ speed: context.speed, stepIdx: context.stepIdx }),
  on: {
    "playback.skip": { target: ".finished", actions: "goToLastStep" },
  },
  states: {
    intro: {
      on: { "playback.setSpeed": { actions: { type: "setSpeed", params: ({ event }) => ({ speed: event.speed }) } } },
      after: { introDelay: { target: "playing", actions: "sendStepPlayed" } },
    },
    playing: {
      after: {
        stepDelay: [
          { guard: "isLastStep", target: "finished" },
          { target: "playing", reenter: true, actions: ["nextStep", "sendStepPlayed"] },
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
      on: {
        "playback.resume": "playing",
        "playback.setSpeed": { actions: { type: "setSpeed", params: ({ event }) => ({ speed: event.speed }) } },
      },
    },
    finished: { type: "final" },
  },
});

export type PlaybackMachine = typeof playbackMachine;
