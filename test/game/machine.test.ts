import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, fromPromise } from "xstate";
import { gameMachine, INTRO_DELAY_MS } from "#/game/machine.ts";
import type { PreparedBattle } from "#/game/prepare-battle.ts";
import type { BattleStep, MoveInfo } from "#/game/types.ts";

const tackle: MoveInfo = { name: "tackle", type: "normal", accuracy: 100, pp: 5, damageClass: "physical", power: 40 };
const steps: BattleStep[] = [
  { type: "start" },
  { type: "use-move", attackerIdx: 0, move: tackle },
  { type: "damage", targetIdx: 1, damage: 30, isCrit: false, eff: 1, currentHp: 0 },
  { type: "end", winnerIdx: 0 },
];
const prepared: PreparedBattle = { setup: { maxHp: [50, 30], moves: [[tackle], [tackle]] }, steps };
const fighters = [
  { id: 1, level: 50 },
  { id: 4, level: 50 },
] as const;

function makeActor(prepare: () => Promise<PreparedBattle>) {
  const machine = gameMachine.provide({ actors: { prepareBattle: fromPromise(prepare) } });
  const actor = createActor(machine, { input: { queryClient: new QueryClient() } });
  actor.start();
  return actor;
}

describe("gameMachine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("goes selection → loading → battle and ignores START while loading", async () => {
    const prepare = vi.fn(async () => prepared);
    const actor = makeActor(prepare);
    expect(actor.getSnapshot().value).toBe("selection");

    actor.send({ type: "START", fighters, seed: 1 });
    actor.send({ type: "START", fighters, seed: 2 }); // doble clic
    expect(actor.getSnapshot().value).toBe("loading");

    await vi.advanceTimersByTimeAsync(0);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().matches({ battle: "intro" })).toBe(true);
    expect(actor.getSnapshot().context.seed).toBe(1);
  });

  it("plays every step, emits them, and ends in result", async () => {
    const actor = makeActor(async () => prepared);
    const emitted: number[] = [];
    actor.on("step", (e) => emitted.push(e.stepIdx));
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(actor.getSnapshot().matches({ battle: "playing" })).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(actor.getSnapshot().value).toBe("result");
    expect(emitted).toEqual([0, 1, 2, 3]);
  });

  it("pause stops the timer and resume continues", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    actor.send({ type: "PAUSE" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(actor.getSnapshot().matches({ battle: "paused" })).toBe(true);
    expect(actor.getSnapshot().context.stepIdx).toBe(0);
    actor.send({ type: "RESUME" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(actor.getSnapshot().value).toBe("result");
  });

  it("TOGGLE_SPEED cycles 1x → 2x → 4x → 1x", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    const speeds = [] as number[];
    for (let i = 0; i < 3; i++) {
      actor.send({ type: "TOGGLE_SPEED" });
      speeds.push(actor.getSnapshot().context.speed);
    }
    expect(speeds).toEqual([2, 4, 1]);
  });

  it("SKIP jumps to result at the last step", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(0);
    actor.send({ type: "SKIP" });
    expect(actor.getSnapshot().value).toBe("result");
    expect(actor.getSnapshot().context.stepIdx).toBe(steps.length - 1);
  });

  it("fetch errors lead to a recoverable error state", async () => {
    let fail = true;
    const actor = makeActor(async () => {
      if (fail) throw new Error("network");
      return prepared;
    });
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().value).toBe("error");
    expect((actor.getSnapshot().context.error as Error).message).toBe("network");

    fail = false;
    actor.send({ type: "REMATCH" });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().matches({ battle: "intro" })).toBe(true);

    actor.send({ type: "SKIP" });
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");
    expect(actor.getSnapshot().context.logs).toEqual([]);
  });

  it("REMATCH from result reloads with a new seed", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters, seed: 7 });
    await vi.advanceTimersByTimeAsync(0);
    actor.send({ type: "SKIP" });
    actor.send({ type: "REMATCH" });
    expect(actor.getSnapshot().value).toBe("loading");
    expect(actor.getSnapshot().context.seed).not.toBeNull();
  });
});

describe("gameMachine tags y clear", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("expone tags por fase y puede() refleja START solo en selección", async () => {
    const actor = makeActor(async () => prepared);
    const clears = vi.fn();
    actor.on("clear", clears);
    expect(actor.getSnapshot().hasTag("selection")).toBe(true);
    expect(actor.getSnapshot().can({ type: "START", fighters })).toBe(true);

    actor.send({ type: "START", fighters });
    expect(actor.getSnapshot().hasTag("loading")).toBe(true);
    expect(actor.getSnapshot().can({ type: "START", fighters })).toBe(false);

    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    actor.send({ type: "PAUSE" });
    expect(actor.getSnapshot().hasTag("battle")).toBe(true);
    expect(actor.getSnapshot().hasTag("paused")).toBe(true);

    actor.send({ type: "SKIP" });
    expect(actor.getSnapshot().hasTag("result")).toBe(true);
    expect(clears).toHaveBeenCalledTimes(2); // al cargar y al terminar
  });
});

describe("gameMachine BACK y batalla vacía", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("BACK durante la batalla vuelve a selección y permite un nuevo START", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(actor.getSnapshot().matches({ battle: "playing" })).toBe(true);

    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");
    expect(actor.getSnapshot().context.logs).toEqual([]);

    actor.send({ type: "START", fighters });
    expect(actor.getSnapshot().value).toBe("loading");
  });

  it("BACK también funciona en pausa y durante la intro", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(0);
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");

    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    actor.send({ type: "PAUSE" });
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");
  });

  it("una batalla sin pasos lleva a error en vez de emitir un paso indefinido", async () => {
    const actor = makeActor(async () => ({ ...prepared, steps: [] }));
    const emitted = vi.fn();
    actor.on("step", emitted);
    actor.send({ type: "START", fighters });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(actor.getSnapshot().value).toBe("error");
    expect(emitted).not.toHaveBeenCalled();
  });
});
