import { describe, expect, it } from "vitest";
import type { MoveDetail } from "#/api/pokeapi/types.gen.ts";
import { mapMoveToMoveInfo } from "#/game/combat.ts";

// Minimal mock de un MoveDetail de la PokéAPI (Physical)
const tackleMove: MoveDetail = {
  id: 33,
  name: "tackle",
  accuracy: 100,
  effect_chance: 0,
  pp: 35,
  priority: 0,
  power: 40,
  damage_class: { name: "physical" },
  type: { name: "normal" },
  target: { name: "selected-pokemon" },
  meta: {
    ailment: { name: "none" },
    category: { name: "damage" },
    min_hits: null,
    max_hits: null,
    min_turns: null,
    max_turns: null,
    drain: 0,
    healing: 0,
    crit_rate: 0,
    ailment_chance: 0,
    flinch_chance: 0,
    stat_chance: 0,
  },
  stat_changes: [],
  names: [{ name: "Tackle", language: { name: "en" } }],
  contest_combos: { normal: { use_before: [], use_after: [] }, super: { use_before: [], use_after: [] } },
  contest_type: { name: "tough" },
  contest_effect: { url: "" },
  effect_entries: [],
  effect_changes: [],
  generation: { name: "generation-i" },
  past_values: [],
  super_contest_effect: { url: "" },
  machines: [],
  flavor_text_entries: [],
  learned_by_pokemon: [],
} as unknown as MoveDetail;

describe("mapMoveToMoveInfo", () => {
  it("maps a physical move (Tackle) to MoveInfo", () => {
    const result = mapMoveToMoveInfo(tackleMove);
    expect(result.damageClass).toBe("physical");
    expect(result.name).toBe("tackle"); // fallback: no hay nombre en español en el mock
    expect(result.type).toBe("normal");
    expect(result.power).toBe(40);
    expect(result.accuracy).toBe(100);
  });

  it("maps a special move (Flamethrower) to MoveInfo", () => {
    const move = {
      ...tackleMove,
      name: "flamethrower",
      damage_class: { name: "special" },
      type: { name: "fire" },
      power: 90,
    };
    const result = mapMoveToMoveInfo(move as unknown as MoveDetail);
    expect(result.damageClass).toBe("special");
    expect(result.type).toBe("fire");
    expect(result.power).toBe(90);
  });

  it("maps a status move with stat changes (Growl) to MoveInfo", () => {
    const move = {
      ...tackleMove,
      name: "growl",
      power: null,
      damage_class: { name: "status" },
      type: { name: "normal" },
      accuracy: 100,
      meta: {
        ...tackleMove.meta,
        category: { name: "net-good-stats" },
        ailment: { name: "none" },
        healing: 0,
      },
      stat_changes: [{ change: -1, stat: { name: "attack" } }],
    };
    const result = mapMoveToMoveInfo(move as unknown as MoveDetail);
    expect(result.damageClass).toBe("status");
    expect(result.power).toBeNull();
    if (result.damageClass === "status" && result.effect.kind === "stat-change") {
      expect(result.effect.changes).toEqual([{ stat: "atk", change: -1 }]);
    } else {
      expect.fail("Expected stat-change effect");
    }
  });

  it("maps a status move with ailment (Thunder Wave) to MoveInfo", () => {
    const move = {
      ...tackleMove,
      name: "thunder-wave",
      power: null,
      damage_class: { name: "status" },
      type: { name: "electric" },
      accuracy: 90,
      meta: {
        ...tackleMove.meta,
        category: { name: "ailment" },
        ailment: { name: "paralysis" },
        healing: 0,
      },
      stat_changes: [],
    };
    const result = mapMoveToMoveInfo(move as unknown as MoveDetail);
    expect(result.damageClass).toBe("status");
    if (result.damageClass === "status" && result.effect.kind === "ailment") {
      expect(result.effect.ailment).toBe("paralysis");
    } else {
      expect.fail("Expected ailment effect");
    }
  });

  it("maps a status move with heal (Recover) to MoveInfo", () => {
    const move = {
      ...tackleMove,
      name: "recover",
      power: null,
      damage_class: { name: "status" },
      type: { name: "normal" },
      accuracy: null,
      meta: {
        ...tackleMove.meta,
        category: { name: "heal" },
        ailment: { name: "none" },
        healing: 50,
      },
      stat_changes: [],
    };
    const result = mapMoveToMoveInfo(move as unknown as MoveDetail);
    expect(result.damageClass).toBe("status");
    if (result.damageClass === "status" && result.effect.kind === "heal") {
      expect(result.effect.percentage).toBe(50);
    } else {
      expect.fail("Expected heal effect");
    }
  });
});
