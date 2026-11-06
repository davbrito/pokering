import { describe, expect, it } from "vitest";
import { gameMachine } from "#/game/machine.ts";
import { playbackMachine } from "#/game/playback-machine.ts";
import type { PreparedBattle } from "#/game/prepare-battle.ts";
import { stageFxMachine } from "#/game/stage-fx-machine.ts";
import type { BattleStep, MoveInfo } from "#/game/types.ts";
import { describeTransition, uncoveredTransitions } from "./helpers/transitions.ts";

/**
 * Cobertura de transiciones: `@xstate/graph` recorre el espacio de estados de cada máquina con un conjunto
 * finito de eventos y el test falla si alguna transición declarada no se alcanza. Un estado o evento nuevo
 * sin camino hace fallar la suite; para cubrirlo, añade su evento a la lista de la máquina correspondiente.
 */
const tackle: MoveInfo = { name: "tackle", type: "normal", accuracy: 100, pp: 5, damageClass: "physical", power: 40 };
const steps: BattleStep[] = [{ type: "start" }, { type: "use-move", attackerIdx: 0, move: tackle }];
const prepared: PreparedBattle = { setup: { maxHp: [50, 30], moves: [[tackle], [tackle]] }, steps };
const fighters = [
  { id: 1, level: 50 },
  { id: 4, level: 50 },
] as const;

const expectFullCoverage = (uncovered: ReturnType<typeof uncoveredTransitions>) =>
  expect(uncovered.map(describeTransition)).toEqual([]);

describe("cobertura de transiciones", () => {
  it("falla si falta un evento: sin `battle.exit` queda sin recorrer", () => {
    const uncovered = uncoveredTransitions(gameMachine, () => [{ type: "battle.start", fighters, seed: 1 }] as never);
    expect(uncovered.map(describeTransition)).toContain("game.match --battle.exit--> game.selection");
  });

  it("gameMachine", () => {
    expectFullCoverage(
      uncoveredTransitions(
        // `forwardToFx` lee los actores vivos; en una transición pura no los hay, así que se neutraliza.
        gameMachine.provide({ actions: { forwardToFx: () => {} } }),
        () =>
          [
            { type: "battle.start", fighters, seed: 1 },
            { type: "battle.rematch", seed: 2 },
            { type: "battle.retry" },
            { type: "battle.exit" },
            { type: "playback.pause" },
            { type: "playback.resume" },
            { type: "playback.setSpeed", speed: 2 },
            { type: "playback.skip" },
            { type: "step.played", step: steps[0], stepIdx: 0, speed: 1 },
            // Hechos de los actores hijos (el grafo no ejecuta actores: se entregan a mano)
            { type: "xstate.done.actor.prepareBattle", output: prepared },
            { type: "xstate.done.actor.prepareBattle", output: { ...prepared, steps: [] } },
            { type: "xstate.error.actor.prepareBattle", error: new Error("boom") },
            { type: "xstate.done.actor.playback", output: { speed: 1, stepIdx: 1 } },
          ] as never,
      ),
    );
  });

  it("playbackMachine", () => {
    expectFullCoverage(
      uncoveredTransitions(
        // Sin padre en una transición pura: se neutraliza solo el envío (`sendParent`), no las transiciones.
        playbackMachine.provide({ actions: { sendStepPlayed: () => {} } }),
        () =>
          [
            { type: "playback.pause" },
            { type: "playback.resume" },
            { type: "playback.setSpeed", speed: 2 },
            { type: "playback.skip" },
            { type: "xstate.after.introDelay.playback.intro" },
            // dt grande: termina el paso; dt 0: solo acumula; el último paso termina la reproducción
            { type: "clock.tick", dt: 1_000_000 },
            { type: "clock.tick", dt: 0 },
          ] as never,
        {
          input: { steps, speed: 1 },
          // El avance de paso (`stepIdx`) cambia qué transiciones del reloj son posibles.
          key: (s) => [s.value, s.context.stepIdx],
        },
      ),
    );
  });

  it("stageFxMachine", () => {
    expectFullCoverage(
      uncoveredTransitions(
        stageFxMachine,
        () =>
          [
            { type: "fx.play", step: steps[1], speed: 1 },
            { type: "playback.pause" },
            { type: "playback.resume" },
            { type: "playback.setSpeed", speed: 4 },
            { type: "clock.tick", dt: 16 },
          ] as never,
      ),
    );
  });
});
