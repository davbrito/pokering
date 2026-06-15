import { describe, expect, it } from "vitest";
import { selectBattleMoves } from "#/game/combat/moves.ts";
import type { MoveInfo } from "#/game/types.ts";

const physical1: MoveInfo = {
  damageClass: "physical",
  name: "tackle",
  type: "normal",
  accuracy: 100,
  pp: 35,
  power: 40,
};
const physical2: MoveInfo = {
  damageClass: "physical",
  name: "body-slam",
  type: "normal",
  accuracy: 100,
  pp: 15,
  power: 85,
};
const special1: MoveInfo = {
  damageClass: "special",
  name: "flamethrower",
  type: "fire",
  accuracy: 100,
  pp: 15,
  power: 90,
};
const statMove: MoveInfo = {
  damageClass: "status",
  name: "growl",
  type: "normal",
  accuracy: 100,
  pp: 40,
  power: null,
  effect: { kind: "stat-change", changes: [{ stat: "atk", change: -1 }] },
};
const healMove: MoveInfo = {
  damageClass: "status",
  name: "recover",
  type: "normal",
  accuracy: null,
  pp: 10,
  power: null,
  effect: { kind: "heal", percentage: 50 },
};
const ailmentMove: MoveInfo = {
  damageClass: "status",
  name: "thunder-wave",
  type: "electric",
  accuracy: 90,
  pp: 20,
  power: null,
  effect: { kind: "ailment", ailment: "paralysis" },
};

const allMoves = [physical1, physical2, special1, statMove, healMove, ailmentMove];

describe("selectBattleMoves", () => {
  it("curates 4 moves: best physical, best special, stat/heal, ailment", () => {
    const result = selectBattleMoves(allMoves);
    expect(result).toHaveLength(4);
    // Slot 1: best physical (highest power)
    expect(result[0].damageClass).toBe("physical");
    if (result[0].damageClass === "physical") expect(result[0].power).toBe(85);
    // Slot 2: best special
    expect(result[1].damageClass).toBe("special");
    // Slot 3: stat-change or heal
    expect(result[2].damageClass).toBe("status");
    if (result[2].damageClass === "status") {
      expect(result[2].effect.kind === "stat-change" || result[2].effect.kind === "heal").toBe(true);
    }
    // Slot 4: ailment
    expect(result[3].damageClass).toBe("status");
    if (result[3].damageClass === "status") {
      expect(result[3].effect.kind === "ailment").toBe(true);
    }
  });

  it("returns empty array for empty input", () => {
    expect(selectBattleMoves([])).toEqual([]);
  });
});
