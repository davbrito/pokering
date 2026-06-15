import { describe, expect, it } from "vitest";
import { selectBattleMoves } from "#/game/combat/moves.ts";
import type { MoveInfo, PokemonStats } from "#/game/types.ts";

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
const physical3: MoveInfo = {
  damageClass: "physical",
  name: "earthquake",
  type: "ground",
  accuracy: 100,
  pp: 10,
  power: 100,
};
const special1: MoveInfo = {
  damageClass: "special",
  name: "flamethrower",
  type: "fire",
  accuracy: 100,
  pp: 15,
  power: 90,
};
const special2: MoveInfo = {
  damageClass: "special",
  name: "surf",
  type: "water",
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

const allMoves = [physical1, physical2, physical3, special1, special2, statMove, healMove, ailmentMove];

/** Stats balanceadas: sin sesgo físico ni especial. */
const balancedStats: PokemonStats = { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };

/** Sesgo físico: ATK >> SpA. */
const physicalBiasStats: PokemonStats = { hp: 100, atk: 150, def: 100, spa: 50, spd: 100, spe: 100 };

/** Sesgo especial: SpA >> ATK. */
const specialBiasStats: PokemonStats = { hp: 100, atk: 50, def: 100, spa: 150, spd: 100, spe: 100 };

describe("selectBattleMoves", () => {
  it("returns 4 moves with balanced stats: 1 physical, 1 special, stat/heal, ailment", () => {
    const result = selectBattleMoves(allMoves, balancedStats);
    expect(result).toHaveLength(4);

    const types = result.map((m) => m.damageClass);
    const physicalCount = types.filter((t) => t === "physical").length;
    const specialCount = types.filter((t) => t === "special").length;
    const statusCount = types.filter((t) => t === "status").length;

    expect(physicalCount).toBe(1);
    expect(specialCount).toBe(1);
    expect(statusCount).toBe(2);

    // Los movimientos seleccionados deben estar en el Top 3 por poder
    const topPhysicalPower = [physical3, physical2, physical1].map((m) => m.power);
    const topSpecialPower = [special1, special2].map((m) => m.power);
    const pMove = result.find((m) => m.damageClass === "physical")!;
    const sMove = result.find((m) => m.damageClass === "special")!;
    expect(topPhysicalPower).toContain(pMove.power);
    expect(topSpecialPower).toContain(sMove.power);

    // Slots de estado: stat-change/heal y ailment
    const statusMoves = result.filter((m) => m.damageClass === "status");
    const kinds = statusMoves.map((m) => (m.damageClass === "status" ? m.effect.kind : null));
    // stat encuentra el primero (stat-change), ailment encuentra el segundo (ailment)
    expect(kinds.filter((k) => k === "stat-change" || k === "heal").length).toBe(1);
    expect(kinds).toContain("ailment");
  });

  it("returns 2 physical moves when ATK >> SpA (sesgo físico)", () => {
    // Ejecutar varias veces para confirmar el patrón (el orden interno tiene azar)
    for (let i = 0; i < 10; i++) {
      const result = selectBattleMoves(allMoves, physicalBiasStats);
      const physicalMoves = result.filter((m) => m.damageClass === "physical");
      expect(physicalMoves.length).toBe(2);
      expect(result.filter((m) => m.damageClass === "special").length).toBe(0);
    }
  });

  it("returns 2 special moves when SpA >> ATK (sesgo especial)", () => {
    for (let i = 0; i < 10; i++) {
      const result = selectBattleMoves(allMoves, specialBiasStats);
      const specialMoves = result.filter((m) => m.damageClass === "special");
      expect(specialMoves.length).toBe(2);
      expect(result.filter((m) => m.damageClass === "physical").length).toBe(0);
    }
  });

  it("picks different moves across calls (ruleta competitiva)", () => {
    // Con 3 físicos y 2 especiales en el pool, al menos algunas ejecuciones
    // deberían dar combinaciones distintas
    const signatures = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = selectBattleMoves(allMoves, balancedStats);
      const sig = result
        .map((m) => m.name)
        .sort()
        .join(",");
      signatures.add(sig);
    }
    // Esperamos al menos 2 combinaciones distintas
    expect(signatures.size).toBeGreaterThanOrEqual(2);
  });

  it("returns empty array for empty input", () => {
    expect(selectBattleMoves([])).toEqual([]);
  });

  it("returns empty array for empty input even with stats", () => {
    expect(selectBattleMoves([], balancedStats)).toEqual([]);
  });
});
