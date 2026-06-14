import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectMove } from "#/game/combat.ts";
import * as randomModule from "#/game/random.ts";
import type { AilmentState, MoveInfo, StatStages } from "#/game/types.ts";

const physical: MoveInfo = { damageClass: "physical", name: "tackle", type: "normal", accuracy: 100, power: 40 };
const heal: MoveInfo = {
  damageClass: "status",
  name: "recover",
  type: "normal",
  accuracy: null,
  power: null,
  effect: { kind: "heal", percentage: 50 },
};
const ailment: MoveInfo = {
  damageClass: "status",
  name: "thunder-wave",
  type: "electric",
  accuracy: 90,
  power: null,
  effect: { kind: "ailment", ailment: "paralysis" },
};

const emptyAilment: AilmentState = { type: null };
const burnAilment: AilmentState = { type: "burn" };
const baseStages: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

const stats = { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };
const types = ["normal"];

describe("selectMove", () => {
  beforeEach(() => {
    vi.spyOn(randomModule, "randomProbability").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("picks damaging move when no status moves available", () => {
    const result = selectMove([physical], stats, types, types, stats, 100, 200, emptyAilment, baseStages);
    expect(result.damageClass).toBe("physical");
  });

  it("picks heal when HP is low and status roll succeeds", () => {
    vi.spyOn(randomModule, "randomProbability").mockReturnValue(true);
    const result = selectMove([physical, heal], stats, types, types, stats, 80, 200, emptyAilment, baseStages);
    expect(result.damageClass).toBe("status");
    if (result.damageClass === "status") {
      expect(result.effect.kind).toBe("heal");
    }
  });

  it("picks ailment when defender has no ailment and status roll succeeds", () => {
    vi.spyOn(randomModule, "randomProbability").mockReturnValue(true);
    const result = selectMove([physical, ailment], stats, types, types, stats, 200, 200, emptyAilment, baseStages);
    if (result.damageClass === "status" && result.effect.kind === "ailment") {
      expect(result.effect.ailment).toBe("paralysis");
    }
  });

  it("does not pick ailment if defender already has one (falls back to attack)", () => {
    vi.spyOn(randomModule, "randomProbability").mockReturnValue(true);
    const result = selectMove([physical, ailment], stats, types, types, stats, 200, 200, burnAilment, baseStages);
    expect(result.damageClass).toBe("physical");
  });

  it("returns struggle (physical) when no moves", () => {
    const result = selectMove([], stats, types, types, stats, 200, 200, emptyAilment, baseStages);
    expect(result.damageClass).toBe("physical");
    expect(result.name).toBe("struggle");
  });
});
