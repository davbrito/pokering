import { assign, enqueueActions, setup } from "xstate";
import { stepDuration } from "./battle-state";
import { type ClockTickEvent, clock } from "./clock";
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
  /** Tiempo ya transcurrido del paso actual, en ms a velocidad 1x (se conserva al pausar y al cambiar de velocidad). */
  elapsed: number;
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

function stepEnds(context: PlaybackContext, dt: number): boolean {
  const step = context.steps[context.stepIdx];
  return !step || context.elapsed + dt * context.speed >= stepDuration(step);
}

export const playbackMachine = setup({
  types: {
    context: {} as PlaybackContext,
    events: {} as PlaybackEvent | ClockTickEvent,
    input: {} as PlaybackInput,
    output: {} as PlaybackOutput,
    tags: {} as "paused",
  },
  actors: { clock },
  delays: {
    introDelay: INTRO_DELAY_MS,
  },
  guards: {
    // El paso actual termina con este tick. El tiempo se acumula en unidades de 1x, así que un cambio de
    // velocidad reescala el resto sin reiniciar nada.
    stepEnds: ({ context }, params: { dt: number }) => stepEnds(context, params.dt),
    lastStepEnds: ({ context }, params: { dt: number }) =>
      stepEnds(context, params.dt) && context.stepIdx >= context.steps.length - 1,
  },
  actions: {
    setSpeed: assign((_, params: { speed: Speed }) => ({ speed: params.speed })),
    addElapsed: assign({
      elapsed: ({ context }, params: { dt: number }) => context.elapsed + params.dt * context.speed,
    }),
    // El tiempo sobrante del tick pasa al paso siguiente: la reproducción no acumula retraso.
    nextStep: assign(({ context }, params: { dt: number }) => {
      const step = context.steps[context.stepIdx];
      const overshoot = step ? context.elapsed + params.dt * context.speed - stepDuration(step) : 0;
      return { stepIdx: context.stepIdx + 1, elapsed: Math.max(0, overshoot) };
    }),
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
  context: ({ input }) => ({ steps: input.steps, stepIdx: 0, speed: input.speed, elapsed: 0 }),
  output: ({ context }) => ({ speed: context.speed, stepIdx: context.stepIdx }),
  on: {
    "playback.skip": { target: ".finished", actions: "goToLastStep" },
  },
  states: {
    intro: {
      on: { "playback.setSpeed": { actions: { type: "setSpeed", params: ({ event }) => ({ speed: event.speed }) } } },
      after: { introDelay: { target: "playing", actions: "sendStepPlayed" } },
    },
    // `running` y `paused` comparten `playing`: pausar solo detiene el reloj, el progreso del paso queda en `elapsed`.
    playing: {
      initial: "running",
      on: { "playback.setSpeed": { actions: { type: "setSpeed", params: ({ event }) => ({ speed: event.speed }) } } },
      states: {
        running: {
          invoke: { id: "clock", src: "clock" },
          on: {
            "playback.pause": "paused",
            "clock.tick": [
              {
                guard: { type: "lastStepEnds", params: ({ event }) => ({ dt: event.dt }) },
                target: "#playback.finished",
              },
              {
                guard: { type: "stepEnds", params: ({ event }) => ({ dt: event.dt }) },
                actions: [{ type: "nextStep", params: ({ event }) => ({ dt: event.dt }) }, "sendStepPlayed"],
              },
              { actions: { type: "addElapsed", params: ({ event }) => ({ dt: event.dt }) } },
            ],
          },
        },
        paused: {
          tags: ["paused"],
          on: { "playback.resume": "running" },
        },
      },
    },
    finished: { type: "final" },
  },
});

export type PlaybackMachine = typeof playbackMachine;
