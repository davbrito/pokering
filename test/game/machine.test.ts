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
    expect(actor.getSnapshot().context.request?.seed).toBe(1);
  });

  it("plays every step, emits them, and ends in result", async () => {
    const actor = makeActor(async () => prepared);
    const emitted: number[] = [];
    actor.on("step", (e) => emitted.push(e.stepIdx));
    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(actor.getSnapshot().matches({ battle: "playing" })).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(actor.getSnapshot().value).toBe("result");
    expect(emitted).toEqual([0, 1, 2, 3]);
  });

  it("pause stops the timer and resume continues", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters, seed: 1 });
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
    actor.send({ type: "START", fighters, seed: 1 });
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
    actor.send({ type: "START", fighters, seed: 1 });
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
    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().value).toBe("error");
    expect(actor.getSnapshot().context.error).toBe("network");

    fail = false;
    actor.send({ type: "RETRY" });
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
    actor.send({ type: "REMATCH", seed: 8 });
    expect(actor.getSnapshot().value).toBe("loading");
    expect(actor.getSnapshot().context.request).toEqual({ fighters, seed: 8 });
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
    expect(actor.getSnapshot().can({ type: "START", fighters, seed: 1 })).toBe(true);

    actor.send({ type: "START", fighters, seed: 1 });
    expect(actor.getSnapshot().hasTag("loading")).toBe(true);
    expect(actor.getSnapshot().can({ type: "START", fighters, seed: 1 })).toBe(false);

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
    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(actor.getSnapshot().matches({ battle: "playing" })).toBe(true);

    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");
    expect(actor.getSnapshot().context.logs).toEqual([]);

    actor.send({ type: "START", fighters, seed: 1 });
    expect(actor.getSnapshot().value).toBe("loading");
  });

  it("BACK también funciona en pausa y durante la intro", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(0);
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");

    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    actor.send({ type: "PAUSE" });
    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");
  });

  it("una batalla sin pasos lleva a error en vez de emitir un paso indefinido", async () => {
    const actor = makeActor(async () => ({ ...prepared, steps: [] }));
    const emitted = vi.fn();
    actor.on("step", emitted);
    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(actor.getSnapshot().value).toBe("error");
    expect(emitted).not.toHaveBeenCalled();
  });
});

describe("gameMachine determinismo, RETRY y cancelación", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("RETRY conserva la semilla y limpia el error", async () => {
    const seeds: number[] = [];
    let fail = true;
    const machine = gameMachine.provide({
      actors: {
        prepareBattle: fromPromise(async ({ input }) => {
          seeds.push(input?.seed ?? -1);
          if (fail) throw new Error("boom");
          return prepared;
        }),
      },
    });
    const actor = createActor(machine).start();
    actor.send({ type: "START", fighters, seed: 42 });
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().value).toBe("error");
    expect(actor.getSnapshot().can({ type: "RETRY" })).toBe(true);
    expect(actor.getSnapshot().can({ type: "REMATCH", seed: 1 })).toBe(false);

    fail = false;
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().context.error).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(seeds).toEqual([42, 42]);
  });

  it("misma secuencia de eventos ⇒ mismo contexto (sin azar propio)", async () => {
    const run = async () => {
      const actor = makeActor(async () => prepared);
      actor.send({ type: "START", fighters, seed: 5 });
      await vi.advanceTimersByTimeAsync(0);
      actor.send({ type: "SKIP" });
      actor.send({ type: "REMATCH", seed: 6 });
      return actor.getSnapshot().context.request;
    };
    expect(await run()).toEqual(await run());
  });

  it("BACK en loading cancela la carga y limpia la batalla anterior", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(0);
    actor.send({ type: "SKIP" });
    actor.send({ type: "REMATCH", seed: 2 });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe("loading");
    expect(snap.context.logs).toEqual([]);
    expect(snap.context.setup).toBeNull();

    actor.send({ type: "BACK" });
    expect(actor.getSnapshot().value).toBe("selection");
    expect(actor.getSnapshot().context.request).toBeNull();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(actor.getSnapshot().value).toBe("selection"); // la carga cancelada no resucita
  });

  it("START se acepta desde result y error, no desde loading ni battle", async () => {
    const actor = makeActor(async () => prepared);
    actor.send({ type: "START", fighters, seed: 1 });
    expect(actor.getSnapshot().can({ type: "START", fighters, seed: 2 })).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().can({ type: "START", fighters, seed: 2 })).toBe(false);
    actor.send({ type: "SKIP" });
    expect(actor.getSnapshot().can({ type: "START", fighters, seed: 2 })).toBe(true);
  });

  it("el contexto (con error) es serializable", async () => {
    const actor = makeActor(async () => {
      throw new Error("x");
    });
    actor.send({ type: "START", fighters, seed: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(() => JSON.stringify(actor.getPersistedSnapshot())).not.toThrow();
    expect(actor.getSnapshot().context.error).toBe("x");
  });
});
