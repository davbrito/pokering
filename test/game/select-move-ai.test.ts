import { describe, expect, it } from "vitest";
import { selectMove } from "#/game/combat/moves.ts";
import type { Rng } from "#/game/rng.ts";
import type { AilmentState, MoveInfo, StatStages } from "#/game/types.ts";

const physical: MoveInfo = {
  damageClass: "physical",
  name: "tackle",
  type: "normal",
  accuracy: 100,
  pp: 35,
  power: 40,
};
const heal: MoveInfo = {
  damageClass: "status",
  name: "recover",
  type: "normal",
  accuracy: null,
  pp: 10,
  power: null,
  effect: { kind: "heal", percentage: 50 },
};
const ailment: MoveInfo = {
  damageClass: "status",
  name: "thunder-wave",
  type: "electric",
  accuracy: 90,
  pp: 20,
  power: null,
  effect: { kind: "ailment", ailment: "paralysis" },
};

const emptyAilment: AilmentState = { type: null };
const burnAilment: AilmentState = { type: "burn" };
const baseStages: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

const stats = { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };
const types = ["normal"];

describe("selectMove", () => {
  // RNG controlado: `chance` devuelve siempre `chanceResult`; el ruido táctico es neutro (1.0).
  const fakeRng = (chanceResult: boolean): Rng => ({
    next: () => 0,
    int: (a) => a,
    float: () => 1,
    chance: () => chanceResult,
    pick: (arr) => arr[0],
  });

  it("picks damaging move when no status moves available", () => {
    const result = selectMove(
      [physical],
      stats,
      types,
      types,
      stats,
      100,
      200,
      emptyAilment,
      baseStages,
      fakeRng(false),
    );
    expect(result.damageClass).toBe("physical");
  });

  it("picks heal when HP is low and status roll succeeds", () => {
    const result = selectMove(
      [physical, heal],
      stats,
      types,
      types,
      stats,
      80,
      200,
      emptyAilment,
      baseStages,
      fakeRng(true),
    );
    expect(result.damageClass).toBe("status");
    if (result.damageClass === "status") {
      expect(result.effect.kind).toBe("heal");
    }
  });

  it("picks ailment when defender has no ailment and status roll succeeds", () => {
    const result = selectMove(
      [physical, ailment],
      stats,
      types,
      types,
      stats,
      200,
      200,
      emptyAilment,
      baseStages,
      fakeRng(true),
    );
    if (result.damageClass === "status" && result.effect.kind === "ailment") {
      expect(result.effect.ailment).toBe("paralysis");
    }
  });

  it("does not pick ailment if defender already has one (falls back to attack)", () => {
    const result = selectMove(
      [physical, ailment],
      stats,
      types,
      types,
      stats,
      200,
      200,
      burnAilment,
      baseStages,
      fakeRng(false),
    );
    expect(result.damageClass).toBe("physical");
  });

  it("returns struggle (physical) when no moves", () => {
    const result = selectMove([], stats, types, types, stats, 200, 200, emptyAilment, baseStages, fakeRng(false));
    expect(result.damageClass).toBe("physical");
    expect(result.name).toBe("struggle");
  });
});
