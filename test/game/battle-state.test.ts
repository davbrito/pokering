import { describe, expect, it } from "vitest";
import { applyStep, type BattleSetup, deriveBattleViewState, initialBattleViewState } from "#/game/battle-state.ts";
import type { BattleStep, MoveInfo } from "#/game/types.ts";

const tackle: MoveInfo = { name: "tackle", type: "normal", accuracy: 100, pp: 2, damageClass: "physical", power: 40 };
const ember: MoveInfo = { name: "ember", type: "fire", accuracy: 100, pp: 5, damageClass: "special", power: 40 };

const setup: BattleSetup = { maxHp: [100, 80], moves: [[tackle], [ember]] };

describe("applyStep", () => {
  it("starts with full HP and full PP", () => {
    expect(initialBattleViewState(setup)).toEqual({ hp: [100, 80], pp: [[2], [5]] });
  });

  it("applies damage to the target only", () => {
    const step: BattleStep = { type: "damage", targetIdx: 1, damage: 30, isCrit: false, eff: 1, currentHp: 50 };
    expect(applyStep(initialBattleViewState(setup), step, setup).hp).toEqual([100, 50]);
  });

  it("spends one PP when a move is used, never below zero", () => {
    const step: BattleStep = { type: "use-move", attackerIdx: 0, move: tackle };
    let state = initialBattleViewState(setup);
    state = applyStep(state, step, setup);
    expect(state.pp).toEqual([[1], [5]]);
    state = applyStep(applyStep(state, step, setup), step, setup);
    expect(state.pp[0]).toEqual([0]);
  });

  it("ignores moves not in the moveset (e.g. struggle)", () => {
    const state = initialBattleViewState(setup);
    const step: BattleStep = { type: "use-move", attackerIdx: 0, move: { ...tackle, name: "struggle" } };
    expect(applyStep(state, step, setup)).toBe(state);
  });

  it("applies heal, burn damage and recoil HP", () => {
    let state = initialBattleViewState(setup);
    state = applyStep(
      state,
      {
        type: "passive",
        targetIdx: 0,
        payload: { subType: "residual-damage", reason: "burn", damage: 6, currentHp: 94 },
      },
      setup,
    );
    state = applyStep(
      state,
      { type: "passive", targetIdx: 1, payload: { subType: "recoil", damage: 20, currentHp: 60 } },
      setup,
    );
    state = applyStep(
      state,
      {
        type: "status",
        attackerIdx: 1,
        targetIdx: 1,
        moveName: "recover",
        payload: { subType: "heal", amount: 10, currentHp: 70 },
      },
      setup,
    );
    expect(state.hp).toEqual([94, 70]);
  });

  it("leaves state untouched for other steps and never mutates its input", () => {
    const state = initialBattleViewState(setup);
    const snapshot = structuredClone(state);
    applyStep(state, { type: "use-move", attackerIdx: 1, move: ember }, setup);
    applyStep(state, { type: "start" }, setup);
    expect(state).toEqual(snapshot);
  });
});

describe("deriveBattleViewState", () => {
  const steps: BattleStep[] = [
    { type: "start" },
    { type: "use-move", attackerIdx: 0, move: tackle },
    { type: "damage", targetIdx: 1, damage: 30, isCrit: false, eff: 1, currentHp: 50 },
    { type: "end", winnerIdx: 0 },
  ];

  it("replays steps up to and including stepIdx", () => {
    expect(deriveBattleViewState(setup, steps, 0)).toEqual({ hp: [100, 80], pp: [[2], [5]] });
    expect(deriveBattleViewState(setup, steps, 1).pp).toEqual([[1], [5]]);
    expect(deriveBattleViewState(setup, steps, 2).hp).toEqual([100, 50]);
    expect(deriveBattleViewState(setup, steps, 99).hp).toEqual([100, 50]);
  });
});
