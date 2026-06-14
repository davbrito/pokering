import { describe, expect, it } from "vitest";
import { scaleStatsByLevel } from "#/game/combat.ts";

describe("scaleStatsByLevel", () => {
  it("scales HP at level 50: floor(2*b*50/100) + 50 + 10", () => {
    const result = scaleStatsByLevel({ hp: 100, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }, 50);
    // HP = floor(2*100*50/100) + 50 + 10 = floor(100) + 60 = 160
    expect(result.hp).toBe(160);
  });

  it("scales non-HP stats at level 50: floor(2*b*50/100) + 5", () => {
    const result = scaleStatsByLevel({ hp: 100, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }, 50);
    // atk = floor(2*80*50/100) + 5 = floor(80) + 5 = 85
    expect(result.atk).toBe(85);
  });

  it("scales HP at level 100", () => {
    const result = scaleStatsByLevel({ hp: 100, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }, 100);
    // HP = floor(2*100*100/100) + 100 + 10 = 200 + 110 = 310
    expect(result.hp).toBe(310);
  });

  it("scales non-HP stats at level 1", () => {
    const result = scaleStatsByLevel({ hp: 100, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }, 1);
    // atk = floor(2*80*1/100) + 5 = floor(1.6) + 5 = 6
    expect(result.atk).toBe(6);
  });
});
