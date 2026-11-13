import { describe, expect, it } from "vitest";
import { calculateAttackDamage } from "#/game/combat.ts";
import { getEffectiveness, getStabMultiplier } from "#/game/combat/moves.ts";
import { createRng, type Rng } from "#/game/rng.ts";

/** RNG controlado: `crit` decide el crítico y `roll` es el factor aleatorio (0.85–1.00). */
function fixedRng({ crit = false, roll = 1 }: { crit?: boolean; roll?: number } = {}): Rng {
  return {
    next: () => 0,
    int: (a) => a,
    float: () => roll,
    chance: () => crit,
    pick: (arr) => arr[0],
  };
}

describe("getStabMultiplier", () => {
  it("returns 1.5 when the move type matches one of the attacker's types", () => {
    expect(getStabMultiplier("fire", ["fire"])).toBe(1.5);
    expect(getStabMultiplier("flying", ["normal", "flying"])).toBe(1.5);
  });

  it("returns 1 when the move type does not match", () => {
    expect(getStabMultiplier("water", ["fire"])).toBe(1);
    expect(getStabMultiplier("water", [])).toBe(1);
  });
});

describe("getEffectiveness", () => {
  it("handles super effective, resisted and neutral matchups", () => {
    expect(getEffectiveness("fire", ["grass"])).toBe(2);
    expect(getEffectiveness("fire", ["water"])).toBe(0.5);
    expect(getEffectiveness("fire", ["normal"])).toBe(1);
  });

  it("handles immunities", () => {
    expect(getEffectiveness("normal", ["ghost"])).toBe(0);
    expect(getEffectiveness("ground", ["flying"])).toBe(0);
  });

  it("multiplies the effectiveness against each defender type", () => {
    expect(getEffectiveness("fire", ["grass", "ice"])).toBe(4);
    expect(getEffectiveness("fire", ["water", "rock"])).toBe(0.25);
    expect(getEffectiveness("fire", ["grass", "water"])).toBe(1);
    expect(getEffectiveness("ground", ["flying", "fire"])).toBe(0);
  });

  it("assumes neutral effectiveness for unknown attacker types and ignores unknown defender types", () => {
    expect(getEffectiveness("unknown", ["grass"])).toBe(1);
    expect(getEffectiveness("fire", ["unknown", "grass"])).toBe(2);
    expect(getEffectiveness("fire", [])).toBe(1);
  });
});

describe("calculateAttackDamage", () => {
  // Nv. 50, poder 100, ataque = defensa: base = (22 * 100 * 1) / 50 + 2 = 46
  const damage = (opts: { stab?: number; eff?: number; crit?: boolean; roll?: number; off?: number; def?: number }) =>
    calculateAttackDamage(50, 100, opts.off ?? 100, opts.def ?? 100, opts.stab ?? 1, opts.eff ?? 1, fixedRng(opts));

  it("applies the base formula with the maximum random roll", () => {
    expect(damage({})).toEqual({ damage: 46, isCrit: false });
  });

  it("applies the minimum random roll (0.85)", () => {
    expect(damage({ roll: 0.85 }).damage).toBe(39); // floor(46 * 0.85)
  });

  it("applies STAB and type effectiveness multiplicatively", () => {
    expect(damage({ stab: 1.5 }).damage).toBe(69);
    expect(damage({ eff: 2 }).damage).toBe(92);
    expect(damage({ stab: 1.5, eff: 2 }).damage).toBe(138);
    expect(damage({ eff: 0.5 }).damage).toBe(23);
  });

  it("multiplies the damage by 1.5 on a critical hit", () => {
    expect(damage({ crit: true })).toEqual({ damage: 69, isCrit: true });
  });

  it("scales with the offensive/defensive stat ratio", () => {
    // base = (22 * 100 * 2) / 50 + 2 = 90
    expect(damage({ off: 200, def: 100 }).damage).toBe(90);
  });

  it("deals no damage to an immune target", () => {
    expect(damage({ eff: 0 }).damage).toBe(0);
  });

  it("deals at least 1 damage when the target is not immune", () => {
    const { damage: d } = calculateAttackDamage(50, 1, 1, 1000, 1, 0.25, fixedRng({ roll: 0.85 }));
    expect(d).toBe(1);
  });

  it("is deterministic for the same seed and stays within the random range", () => {
    const run = (seed: number) => calculateAttackDamage(50, 100, 100, 100, 1, 1, createRng(seed));
    for (let seed = 1; seed <= 50; seed++) {
      const a = run(seed);
      expect(a).toEqual(run(seed));
      // sin crítico: [floor(46 * 0.85), 46]; con crítico: hasta floor(46 * 1.5)
      expect(a.damage).toBeGreaterThanOrEqual(39);
      expect(a.damage).toBeLessThanOrEqual(a.isCrit ? 69 : 46);
    }
  });
});
