import { assign, emit, enqueueActions, fromPromise, sendTo, setup } from "xstate";
import {
  type PlaybackEvent,
  type PlaybackOutput,
  playbackMachine,
  type Speed,
  type StepPlayedEvent,
} from "./playback-machine";
import type { Fighter, PrepareBattleInput, PreparedBattle } from "./prepare-battle";
import { stageFxMachine } from "./stage-fx-machine";
import type { BattleStep } from "./types";

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
  | { type: "playback.skip" }
  /** Hecho que llega del actor de reproducción (hijo); el padre lo reemite hacia la vista. */
  | StepPlayedEvent;

/** Hechos que emite la máquina (pasado) para efectos visuales/sonoros. */
export type GameEmitted = { type: "step.played"; step: BattleStep; stepIdx: number } | { type: "battle.ended" };

export type GameTag = "selection" | "loading" | "battle" | "result" | "error";

/** Dentro de `match` el contexto siempre tiene `match`; XState no tipa el contexto por estado. */
export function requireMatch(context: GameContext): Match {
  if (!context.match) throw new Error("invariant: no hay batalla en curso (context.match es null)");
  return context.match;
}

/** Dentro de `playback` la batalla ya está preparada. */
export function requirePrepared(context: GameContext): PreparedBattle {
  if (!context.prepared) throw new Error("invariant: la batalla no está preparada (context.prepared es null)");
  return context.prepared;
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
    playbackMachine,
    stageFx: stageFxMachine,
  },
  guards: {
    hasSteps: (_, params: { steps: readonly BattleStep[] }) => params.steps.length > 0,
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
    // La reproducción es dueña de stepIdx/speed mientras dura; al terminar los devuelve como `output`.
    rememberPlayback: assign((_, params: PlaybackOutput) => ({ speed: params.speed, stepIdx: params.stepIdx })),
    forwardToPlayback: sendTo("playback", ({ event }) => event as PlaybackEvent),
    playFx: sendTo("fx", (_, params: { step: BattleStep; speed: Speed }) => ({
      type: "fx.play" as const,
      step: params.step,
      speed: params.speed,
    })),
    emitStepPlayed: emit((_, params: { step: BattleStep; stepIdx: number }) => ({
      type: "step.played" as const,
      step: params.step,
      stepIdx: params.stepIdx,
    })),
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
          // Cubre fin normal, `playback.skip` y `battle.exit`: la vista limpia sus efectos.
          exit: "emitBattleEnded",
          invoke: [
            {
              id: "playback",
              src: "playbackMachine",
              input: ({ context }) => ({ steps: requirePrepared(context).steps, speed: context.speed }),
              onDone: {
                target: "result",
                actions: { type: "rememberPlayback", params: ({ event }) => event.output },
              },
            },
            // Efectos visuales del escenario: sus temporizadores se detienen al salir de `playback`.
            { id: "fx", src: "stageFx" },
          ],
          on: {
            "playback.*": { actions: "forwardToPlayback" },
            "step.played": {
              actions: [
                { type: "emitStepPlayed", params: ({ event }) => ({ step: event.step, stepIdx: event.stepIdx }) },
                { type: "playFx", params: ({ event }) => ({ step: event.step, speed: event.speed }) },
              ],
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
