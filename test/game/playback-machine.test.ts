import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assign, createActor, fromCallback, type SnapshotFrom, sendTo, setup } from "xstate";
import { stepDuration } from "#/game/battle-state.ts";
import type { ClockTickEvent } from "#/game/clock.ts";
import {
  INTRO_DELAY_MS,
  type PlaybackEvent,
  type PlaybackOutput,
  playbackMachine,
  type Speed,
  type StepPlayedEvent,
} from "#/game/playback-machine.ts";
import type { BattleStep, MoveInfo } from "#/game/types.ts";

const tackle: MoveInfo = { name: "tackle", type: "normal", accuracy: 100, pp: 5, damageClass: "physical", power: 40 };
const steps: BattleStep[] = [
  { type: "start" },
  { type: "use-move", attackerIdx: 0, move: tackle },
  { type: "damage", targetIdx: 1, damage: 30, isCrit: false, eff: 1, currentHp: 0 },
  { type: "end", winnerIdx: 0 },
];
const D = steps.map(stepDuration); // [2200, 1800, 600, 2500]

/** Reloj controlado por el test: `tick(dt)` solo llega si el reloj está vivo (estado `running`). */
let tick: (dt: number) => void = () => {};
const fakeClock = fromCallback<ClockTickEvent>(({ sendBack }) => {
  tick = (dt) => sendBack({ type: "clock.tick", dt });
  return () => {
    tick = () => {};
  };
});

/** Padre mínimo: recibe `step.played`, reenvía `playback.*` y guarda el `output` al terminar. */
function makeHarness(speed: Speed = 1) {
  const parent = setup({
    types: {
      context: {} as { played: number[]; output: PlaybackOutput | null },
      events: {} as StepPlayedEvent | PlaybackEvent,
    },
    actors: { playback: playbackMachine.provide({ actors: { clock: fakeClock } }) },
  }).createMachine({
    context: { played: [], output: null },
    invoke: {
      id: "playback",
      src: "playback",
      input: { steps, speed },
      onDone: { actions: assign({ output: ({ event }) => event.output }) },
    },
    on: {
      "step.played": { actions: assign({ played: ({ context, event }) => [...context.played, event.stepIdx] }) },
      "playback.*": { actions: sendTo("playback", ({ event }) => event as PlaybackEvent) },
    },
  });
  const actor = createActor(parent).start();
  const child = () => {
    const ref = actor.getSnapshot().children.playback;
    if (!ref) throw new Error("el actor de reproducción terminó");
    return ref.getSnapshot() as SnapshotFrom<typeof playbackMachine>;
  };
  return {
    actor,
    child,
    played: () => actor.getSnapshot().context.played,
    output: () => actor.getSnapshot().context.output,
  };
}

async function intoStep0(speed: Speed = 1) {
  const h = makeHarness(speed);
  await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
  return h;
}

describe("playbackMachine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("tras la intro envía step.played del paso 0 y arranca el reloj", async () => {
    const h = makeHarness();
    expect(h.child().matches("intro")).toBe(true);
    expect(h.played()).toEqual([]);
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(h.child().matches({ playing: "running" })).toBe(true);
    expect(h.played()).toEqual([0]);
  });

  it("avanza de paso solo cuando el tiempo acumulado alcanza la duración", async () => {
    const h = await intoStep0();
    tick(D[0] - 1);
    expect(h.child().context.stepIdx).toBe(0);
    tick(1);
    expect(h.child().context.stepIdx).toBe(1);
    expect(h.child().context.elapsed).toBe(0);
    expect(h.played()).toEqual([0, 1]);
  });

  it("pausar conserva el progreso del paso y reanudar continúa desde ahí", async () => {
    const h = await intoStep0();
    tick(1000);
    h.actor.send({ type: "playback.pause" });
    expect(h.child().hasTag("paused")).toBe(true);

    tick(60_000); // el reloj está detenido: no llega nada
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.child().context.stepIdx).toBe(0);
    expect(h.child().context.elapsed).toBe(1000);

    h.actor.send({ type: "playback.resume" });
    tick(D[0] - 1000 - 1);
    expect(h.child().context.stepIdx).toBe(0); // falta 1 ms
    tick(1);
    expect(h.child().context.stepIdx).toBe(1);
  });

  it("cambiar la velocidad reescala el tiempo restante del paso en curso", async () => {
    const h = await intoStep0();
    tick(1100); // mitad del paso a 1x
    h.actor.send({ type: "playback.setSpeed", speed: 2 });
    expect(h.child().context.elapsed).toBe(1100); // no se reinicia
    tick(549);
    expect(h.child().context.stepIdx).toBe(0);
    tick(1); // 550 ms reales a 2x = 1100 ms de paso
    expect(h.child().context.stepIdx).toBe(1);
  });

  it("pulsar la velocidad repetidamente no impide que el paso termine", async () => {
    const h = await intoStep0();
    for (let i = 0; i < 20; i++) {
      tick(200);
      h.actor.send({ type: "playback.setSpeed", speed: i % 2 ? 2 : 4 });
    }
    expect(h.child().context.stepIdx).toBeGreaterThan(0);
  });

  it("la velocidad inicial viene del input y también puede cambiar en intro y en pausa", async () => {
    const h = makeHarness(4);
    expect(h.child().context.speed).toBe(4);
    h.actor.send({ type: "playback.setSpeed", speed: 2 });
    expect(h.child().context.speed).toBe(2);
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    h.actor.send({ type: "playback.pause" });
    h.actor.send({ type: "playback.setSpeed", speed: 1 });
    expect(h.child().context.speed).toBe(1);
    expect(h.child().hasTag("paused")).toBe(true);
  });

  it("no acepta pausa en intro ni ticks en pausa", async () => {
    const h = makeHarness();
    expect(h.child().can({ type: "playback.pause" })).toBe(false);
    await vi.advanceTimersByTimeAsync(INTRO_DELAY_MS);
    expect(h.child().can({ type: "playback.pause" })).toBe(true);
    h.actor.send({ type: "playback.pause" });
    expect(h.child().can({ type: "clock.tick", dt: 5 })).toBe(false);
    expect(h.child().can({ type: "playback.resume" })).toBe(true);
  });

  it("termina con output {speed, stepIdx} tras el último paso", async () => {
    const h = await intoStep0();
    h.actor.send({ type: "playback.setSpeed", speed: 2 });
    for (const d of D) tick(d / 2);
    expect(h.played()).toEqual([0, 1, 2, 3]);
    expect(h.output()).toEqual({ speed: 2, stepIdx: 3 });
  });

  it("playback.skip salta al último paso y entrega su output", async () => {
    const h = await intoStep0();
    h.actor.send({ type: "playback.skip" });
    expect(h.output()).toEqual({ speed: 1, stepIdx: steps.length - 1 });
  });

  it("detener el actor detiene el reloj (sin ticks huérfanos)", async () => {
    const h = await intoStep0();
    h.actor.stop();
    tick(10_000); // el cleanup del reloj reemplazó `tick` por un no-op
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.played()).toEqual([0]);
  });

  it("el tiempo sobrante de un tick pasa al paso siguiente (sin acumular retraso)", async () => {
    const h = await intoStep0();
    tick(D[0] + 100); // 100 ms de más
    expect(h.child().context.stepIdx).toBe(1);
    expect(h.child().context.elapsed).toBe(100);
    tick(D[1] - 100); // justo lo que falta del paso 1
    expect(h.child().context.stepIdx).toBe(2);
  });

  it("el sobrante respeta la velocidad (a 4x un tick de 16 ms aporta 64 ms de paso)", async () => {
    const h = await intoStep0(4);
    tick(D[0] / 4 + 10); // 10 ms reales de más ⇒ 40 ms de paso
    expect(h.child().context.elapsed).toBe(40);
  });
});
