import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, fromPromise, type SnapshotFrom } from "xstate";
import { gameMachine, requireMatch } from "#/game/machine.ts";
import { INTRO_DELAY_MS, nextSpeed, type playbackMachine } from "#/game/playback-machine.ts";
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
const start = (seed = 1) => ({ type: "battle.start", fighters, seed }) as const;

/** Snapshot del actor hijo de reproducción (existe solo mientras se reproduce). */
function playbackOf(actor: ReturnType<typeof makeActor>) {
  const child = actor.getSnapshot().children.playback;
  if (!child) throw new Error("no hay actor de reproducción");
  return child.getSnapshot() as SnapshotFrom<typeof playbackMachine>;
}

function makeActor(prepare: (seed: number | undefined) => Promise<PreparedBattle>) {
  const machine = gameMachine.provide({
    actors: { prepareBattle: fromPromise(({ input }) => prepare(input.seed)) },
  });
  return createActor(machine).start();
}

describe("gameMachine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("selection → loading → playback, e ignora battle.start mientras carga o reproduce", async () => {
    const prepare = vi.fn(async () => prepared);
    const actor = makeActor(prepare);
    expect(actor.getSnapshot().hasTag("selection")).toBe(true);
    expect(actor.getSnapshot().context.match).toBeNull();

    actor.send(start(1));
    actor.send(start(2)); // doble clic
    expect(actor.getSnapshot().hasTag("loading")).toBe(true);
    expect(actor.getSnapshot().can(start(3))).toBe(false);

    await vi.advanceTimersByTimeAsync(0);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().matches({ match: "playback" })).toBe(true);
    expect(actor.getSnapshot().context.match?.seed).toBe(1);
    expect(actor.getSnapshot().can(start(3))).toBe(false);
  });

  it("reproduce cada paso, emite step.played y battle.ended, y termina en result", async () => {
    const actor = makeActor(async () => prepared);
    const played: number[] = [];
    const ended = vi.fn();
    actor.on("step.played", (e) => played.push(e.stepIdx));
    actor.on("battle.ended", ended);

    actor.send(start());
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(playbackOf(actor).matches("playing")).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(actor.getSnapshot().hasTag("result")).toBe(true);
    expect(played).toEqual([0, 1, 2, 3]);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("pausa detiene el temporizador y resume continúa", async () => {
    const actor = makeActor(async () => prepared);
    actor.send(start());
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    actor.send({ type: "playback.pause" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(playbackOf(actor).hasTag("paused")).toBe(true);
    expect(playbackOf(actor).context.stepIdx).toBe(0);
    actor.send({ type: "playback.resume" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(actor.getSnapshot().hasTag("result")).toBe(true);
  });

  it("playback.setSpeed es explícito, idempotente y válido en intro y en pausa", async () => {
    const actor = makeActor(async () => prepared);
    actor.send(start());
    await vi.advanceTimersByTimeAsync(0);
    expect(playbackOf(actor).matches("intro")).toBe(true);
    actor.send({ type: "playback.setSpeed", speed: 4 });
    actor.send({ type: "playback.setSpeed", speed: 4 });
    expect(playbackOf(actor).context.speed).toBe(4);

    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    actor.send({ type: "playback.pause" });
    actor.send({ type: "playback.setSpeed", speed: 2 });
    expect(playbackOf(actor).context.speed).toBe(2);
    expect(playbackOf(actor).hasTag("paused")).toBe(true);
  });

  it("nextSpeed cicla 1 → 2 → 4 → 1", () => {
    expect([nextSpeed(1), nextSpeed(2), nextSpeed(4)]).toEqual([2, 4, 1]);
  });

  it("playback.skip salta al último paso y emite battle.ended", async () => {
    const actor = makeActor(async () => prepared);
    const ended = vi.fn();
    actor.on("battle.ended", ended);
    actor.send(start());
    await vi.advanceTimersByTimeAsync(0);
    actor.send({ type: "playback.skip" });
    expect(actor.getSnapshot().hasTag("result")).toBe(true);
    expect(actor.getSnapshot().context.stepIdx).toBe(steps.length - 1);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("los errores de carga llevan a error recuperable con battle.retry (misma semilla)", async () => {
    const seeds: (number | undefined)[] = [];
    let fail = true;
    const actor = makeActor(async (seed) => {
      seeds.push(seed);
      if (fail) throw new Error("network");
      return prepared;
    });
    actor.send(start(42));
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().hasTag("error")).toBe(true);
    expect(actor.getSnapshot().context.error).toEqual({ message: "network" });
    expect(actor.getSnapshot().can({ type: "battle.retry" })).toBe(true);
    expect(actor.getSnapshot().can({ type: "battle.rematch", seed: 1 })).toBe(false);

    fail = false;
    actor.send({ type: "battle.retry" });
    expect(actor.getSnapshot().context.error).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().matches({ match: "playback" })).toBe(true);
    expect(seeds).toEqual([42, 42]);
  });

  it("battle.rematch (solo en result) conserva luchadores, cambia la semilla y limpia la batalla anterior", async () => {
    const actor = makeActor(async () => prepared);
    actor.send(start(7));
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().can({ type: "battle.rematch", seed: 8 })).toBe(false);
    actor.send({ type: "playback.skip" });
    actor.send({ type: "battle.rematch", seed: 8 });

    const snap = actor.getSnapshot();
    expect(snap.hasTag("loading")).toBe(true);
    expect(snap.context.match).toEqual({ fighters, seed: 8 });
    expect(snap.context.prepared).toBeNull();
    expect(snap.context.stepIdx).toBe(0);
  });

  it("battle.start se acepta desde result y error, no desde loading ni playback", async () => {
    const actor = makeActor(async () => prepared);
    actor.send(start());
    expect(actor.getSnapshot().can(start(2))).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(actor.getSnapshot().can(start(2))).toBe(false);
    actor.send({ type: "playback.skip" });
    expect(actor.getSnapshot().can(start(2))).toBe(true);
  });

  it("battle.exit funciona en loading, intro, playing, paused, result y error", async () => {
    const exitFrom = async (
      prepare: () => Promise<PreparedBattle>,
      setupFn: (a: ReturnType<typeof makeActor>) => Promise<void>,
    ) => {
      const actor = makeActor(prepare);
      actor.send(start());
      await setupFn(actor);
      actor.send({ type: "battle.exit" });
      expect(actor.getSnapshot().hasTag("selection")).toBe(true);
      expect(actor.getSnapshot().context.match).toBeNull();
      expect(actor.getSnapshot().context.prepared).toBeNull();
      // y se puede iniciar otra
      expect(actor.getSnapshot().can(start(9))).toBe(true);
    };
    const ok = async () => prepared;
    await exitFrom(ok, async () => {}); // loading
    await exitFrom(ok, async () => void (await vi.advanceTimersByTimeAsync(0))); // intro
    await exitFrom(ok, async () => void (await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS))); // playing
    await exitFrom(ok, async (a) => {
      await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
      a.send({ type: "playback.pause" });
    }); // paused
    await exitFrom(ok, async (a) => {
      await vi.advanceTimersByTimeAsync(0);
      a.send({ type: "playback.skip" });
    }); // result
    await exitFrom(
      async () => {
        throw new Error("x");
      },
      async () => void (await vi.advanceTimersByTimeAsync(0)),
    ); // error
  });

  it("battle.exit durante la reproducción emite battle.ended; en loading no hay nada que limpiar", async () => {
    const actor = makeActor(async () => prepared);
    const ended = vi.fn();
    actor.on("battle.ended", ended);
    actor.send(start());
    actor.send({ type: "battle.exit" });
    expect(ended).not.toHaveBeenCalled();

    actor.send(start());
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    actor.send({ type: "battle.exit" });
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("battle.exit en loading cancela la carga: no resucita al resolverse", async () => {
    const actor = makeActor(() => new Promise((resolve) => setTimeout(() => resolve(prepared), 5_000)));
    actor.send(start());
    actor.send({ type: "battle.exit" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(actor.getSnapshot().hasTag("selection")).toBe(true);
  });

  it("una batalla sin pasos lleva a error en vez de emitir un paso indefinido", async () => {
    const actor = makeActor(async () => ({ ...prepared, steps: [] }));
    const played = vi.fn();
    actor.on("step.played", played);
    actor.send(start());
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(actor.getSnapshot().hasTag("error")).toBe(true);
    expect(actor.getSnapshot().context.error).toEqual({ message: "empty battle" });
    expect(played).not.toHaveBeenCalled();
  });

  it("misma secuencia de eventos ⇒ mismo contexto (sin azar propio)", async () => {
    const run = async () => {
      const actor = makeActor(async () => prepared);
      actor.send(start(5));
      await vi.advanceTimersByTimeAsync(0);
      actor.send({ type: "playback.skip" });
      actor.send({ type: "battle.rematch", seed: 6 });
      return actor.getSnapshot().context;
    };
    expect(await run()).toEqual(await run());
  });

  it("el snapshot persistido (con error) es serializable", async () => {
    const actor = makeActor(async () => {
      throw new Error("x");
    });
    actor.send(start());
    await vi.advanceTimersByTimeAsync(0);
    expect(() => JSON.stringify(actor.getPersistedSnapshot())).not.toThrow();
  });

  it("requireMatch falla de forma visible si no hay batalla", () => {
    expect(() => requireMatch({ match: null, prepared: null, stepIdx: 0, speed: 1, error: null })).toThrow(/invariant/);
  });
});
