import { describe, expect, it } from "vitest";
import { applyEndOfTurnDamage, applyStatusEffect } from "#/game/combat.ts";
import type { AilmentState, StatStages } from "#/game/types.ts";

describe("applyStatusEffect", () => {
  const baseStages: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const baseAilment: AilmentState = { type: null };

  it("heals 50% of max HP (Recover) and emits a heal step", () => {
    const maxHp = 200;
    const currentHp = 50; // hurt

    const result = applyStatusEffect(
      { kind: "heal", percentage: 50 },
      0,
      0,
      "recover",
      currentHp,
      maxHp,
      baseStages,
      baseAilment,
    );

    expect(result.hp).toBe(150); // 50 + (200 * 0.5)
    expect(result.steps).toHaveLength(1);
    const step = result.steps[0];
    expect(step.type).toBe("status");
    if (step.type === "status") {
      expect(step.targetIdx).toBe(0);
      expect(step.payload.subType).toBe("heal");
      if (step.payload.subType === "heal") {
        expect(step.payload.amount).toBe(100);
        expect(step.payload.currentHp).toBe(150);
      }
    }
  });

  it("does not overheal (caps at max HP)", () => {
    const maxHp = 200;
    const currentHp = 180;

    const result = applyStatusEffect(
      { kind: "heal", percentage: 50 },
      0,
      0,
      "recover",
      currentHp,
      maxHp,
      baseStages,
      baseAilment,
    );

    expect(result.hp).toBe(200); // capped
    const step = result.steps[0];
    if (step.type === "status" && step.payload.subType === "heal") {
      expect(step.payload.amount).toBe(20);
    }
  });

  it("lowers attack stat by 1 stage (stat-change like Growl)", () => {
    const stages: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    const result = applyStatusEffect(
      { kind: "stat-change", changes: [{ stat: "atk", change: -1 }] },
      1,
      1,
      "growl",
      200,
      200,
      stages,
      baseAilment,
    );

    expect(result.stages.atk).toBe(-1);
    expect(result.steps).toHaveLength(1);
    const step = result.steps[0];
    expect(step.type).toBe("status");
    if (step.type === "status" && step.payload.subType === "stat-change") {
      expect(step.payload.stat).toBe("atk");
      expect(step.payload.change).toBe(-1);
      expect(step.payload.currentStage).toBe(-1);
    }
  });

  it("applies paralysis (ailment like Thunder Wave)", () => {
    const result = applyStatusEffect(
      { kind: "ailment", ailment: "paralysis" },
      1,
      1,
      "thunder-wave",
      200,
      200,
      baseStages,
      baseAilment,
    );

    expect(result.ailment.type).toBe("paralysis");
    expect(result.steps).toHaveLength(1);
    const step = result.steps[0];
    expect(step.type).toBe("status");
    if (step.type === "status" && step.payload.subType === "ailment") {
      expect(step.payload.name).toBe("paralysis");
    }
  });

  it("does not re-apply ailment if target already has one", () => {
    const existingAilment: AilmentState = { type: "burn" };

    const result = applyStatusEffect(
      { kind: "ailment", ailment: "paralysis" },
      1,
      1,
      "thunder-wave",
      200,
      200,
      baseStages,
      existingAilment,
    );

    expect(result.ailment.type).toBe("burn"); // unchanged
    expect(result.steps).toHaveLength(0);
  });
});

describe("applyEndOfTurnDamage", () => {
  it("burn deals 1/16 max HP residual damage", () => {
    const result = applyEndOfTurnDamage({ type: "burn" }, 0, 200, 200);

    expect(result.damage).toBe(12); // floor(200/16)
    expect(result.hp).toBe(188);
    expect(result.fainted).toBe(false);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].type).toBe("passive");
    if (result.steps[0].type === "passive" && result.steps[0].payload.subType === "residual-damage") {
      expect(result.steps[0].payload.damage).toBe(12);
    }
  });

  it("burn damage faints when HP <= 0", () => {
    const result = applyEndOfTurnDamage(
      { type: "burn" },
      0,
      200,
      8, // low HP
    );

    expect(result.hp).toBe(0);
    expect(result.fainted).toBe(true);
  });

  it("no ailment deals no damage", () => {
    const result = applyEndOfTurnDamage({ type: null }, 0, 200, 200);

    expect(result.damage).toBe(0);
    expect(result.hp).toBe(200);
    expect(result.fainted).toBe(false);
    expect(result.steps).toHaveLength(0);
  });
});
