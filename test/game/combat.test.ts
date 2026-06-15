import { describe, expect, it } from "vitest";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { determineFirstAttacker, generateBattleSteps, getStageMultiplier, getStatsObject } from "#/game/combat.ts";
import type { MoveInfo, StatStages } from "#/game/types.ts";

describe("getStageMultiplier", () => {
  it("returns 1.0 for neutral stage 0", () => {
    expect(getStageMultiplier(0)).toBe(1.0);
  });

  it("returns 2.0 for +2 stage (Swords Dance)", () => {
    expect(getStageMultiplier(2)).toBe(2.0);
  });

  it("returns 0.5 for -2 stage (Growl)", () => {
    expect(getStageMultiplier(-2)).toBe(0.5);
  });

  it("returns 1.5 for +1 stage", () => {
    expect(getStageMultiplier(1)).toBe(1.5);
  });

  it("returns 4.0 for max positive stage +6", () => {
    expect(getStageMultiplier(6)).toBe(4.0);
  });

  it("returns 0.25 for max negative stage -6", () => {
    expect(getStageMultiplier(-6)).toBe(0.25);
  });

  it("clamps +7 to +6", () => {
    expect(getStageMultiplier(7)).toBe(getStageMultiplier(6));
  });

  it("clamps -7 to -6", () => {
    expect(getStageMultiplier(-7)).toBe(getStageMultiplier(-6));
  });
});

describe("determineFirstAttacker with speed stages", () => {
  it("P1 with lower base speed but +2 stage goes first", () => {
    const baseSpe1 = 50;
    const baseSpe2 = 80;
    const eff1 = baseSpe1 * getStageMultiplier(2); // 50 * 2 = 100
    const eff2 = baseSpe2 * getStageMultiplier(0); // 80 * 1 = 80
    // P1 effective speed (100) > P2 (80) → P1 first
    expect(determineFirstAttacker(eff1, eff2)).toBe(true);
  });

  it("P2 with -2 speed stage goes second despite higher base", () => {
    const baseSpe1 = 60;
    const baseSpe2 = 100;
    const eff1 = baseSpe1 * getStageMultiplier(0); // 60
    const eff2 = baseSpe2 * getStageMultiplier(-2); // 100 * 0.5 = 50
    // P1 effective speed (60) > P2 (50) → P1 first
    expect(determineFirstAttacker(eff1, eff2)).toBe(true);
  });
});

// Helper para crear un Pokémon mínimo para tests
function makeTestPokemon(overrides: {
  name?: string;
  id?: number;
  types?: string[];
  stats?: Partial<Record<"hp" | "attack" | "defense" | "special-attack" | "special-defense" | "speed", number>>;
}): PokemonDetail {
  const defaults = {
    hp: 100,
    attack: 100,
    defense: 100,
    "special-attack": 100,
    "special-defense": 100,
    speed: 100,
  };
  const s = { ...defaults, ...overrides.stats };
  return {
    name: overrides.name ?? "testmon",
    id: overrides.id ?? 1,
    types: (overrides.types ?? ["normal"]).map((t) => ({ type: { name: t, url: "" }, slot: 1 })),
    stats: Object.entries(s).map(([name, base_stat]) => ({ stat: { name, url: "" }, base_stat, effort: 0 })),
    moves: [],
    sprites: { front_default: "", other: {} },
    height: 10,
    weight: 100,
  } as unknown as PokemonDetail;
}

describe("generateBattleSteps status immunity", () => {
  it("fails a fire-type status move against a Fire-type target", () => {
    const p1 = makeTestPokemon({ name: "caster", types: ["fire"], stats: { speed: 100 } });
    const p2 = makeTestPokemon({ name: "charizard", types: ["fire"], stats: { speed: 50 } });

    const burnMove: MoveInfo = {
      name: "will-o-wisp",
      type: "fire",
      accuracy: 100,
      pp: 10,
      damageClass: "status",
      power: null,
      effect: { kind: "ailment", ailment: "burn" },
    };

    const tackle: MoveInfo = {
      name: "tackle",
      type: "normal",
      accuracy: 100,
      pp: 10,
      damageClass: "physical",
      power: 40,
    };

    const steps = generateBattleSteps(
      p1,
      p2,
      getStatsObject(p1),
      getStatsObject(p2),
      200,
      200,
      [burnMove],
      [tackle],
    );

    expect(steps.some((step) => step.type === "miss")).toBe(true);
    expect(steps.some((step) => step.type === "status" && step.payload.subType === "ailment")).toBe(false);
  });
});

describe("generateBattleSteps applies speed stages to turn order", () => {
  it("pokemon with +6 speed stage attacks first every round", () => {
    const p1 = makeTestPokemon({ name: "fastmon", stats: { speed: 50 } });
    const p2 = makeTestPokemon({ name: "slowmon", stats: { speed: 100 } });

    // P1 has +6 speed (50 * 4 = 200 effective), P2 has 0 (100 effective)
    const p1Stages: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 6 };
    const p2Stages: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    const steps = generateBattleSteps(
      p1,
      p2,
      getStatsObject(p1),
      getStatsObject(p2),
      200,
      200,
      [],
      [],
      p1Stages,
      p2Stages,
    );

    expect(steps.length).toBeGreaterThan(2);
    expect(steps[0].type).toBe("start");

    // Every action from P1 (attackerIdx 0) should come before P2 in each round
    const actionSteps = steps.filter((s) => s.type === "use-move");
    expect(actionSteps.length).toBeGreaterThan(0);
    for (let i = 0; i < actionSteps.length; i += 2) {
      expect(actionSteps[i].attackerIdx).toBe(0);
    }
  });
});
