import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { INITIAL_FX, stageFxMachine } from "#/game/stage-fx-machine.ts";
import type { BattleStep, MoveInfo } from "#/game/types.ts";

const tackle: MoveInfo = { name: "tackle", type: "normal", accuracy: 100, pp: 5, damageClass: "physical", power: 40 };
const ember: MoveInfo = { name: "ember", type: "fire", accuracy: 100, pp: 5, damageClass: "special", power: 40 };

const damage = (over: Partial<Extract<BattleStep, { type: "damage" }>> = {}): BattleStep => ({
  type: "damage",
  targetIdx: 1,
  damage: 30,
  isCrit: false,
  eff: 1,
  currentHp: 10,
  ...over,
});

function makeActor() {
  return createActor(stageFxMachine).start();
}

describe("stageFxMachine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("empieza sin efectos", () => {
    expect(makeActor().getSnapshot().context).toEqual(INITIAL_FX);
  });

  it("embestida física: clase de animación en el atacante y se limpia a 450/speed", async () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: { type: "use-move", attackerIdx: 0, move: tackle }, speed: 1 });
    expect(actor.getSnapshot().context.anim).toEqual(["lunge-right", ""]);
    await vi.advanceTimersByTimeAsync(449);
    expect(actor.getSnapshot().context.anim[0]).toBe("lunge-right");
    await vi.advanceTimersByTimeAsync(1);
    expect(actor.getSnapshot().context.anim).toEqual(["", ""]);

    actor.send({ type: "fx.play", step: { type: "use-move", attackerIdx: 1, move: tackle }, speed: 2 });
    expect(actor.getSnapshot().context.anim).toEqual(["", "lunge-left"]);
    await vi.advanceTimersByTimeAsync(225);
    expect(actor.getSnapshot().context.anim).toEqual(["", ""]);
  });

  it("movimiento especial: proyectil que vence a 380/speed", async () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: { type: "use-move", attackerIdx: 1, move: ember }, speed: 4 });
    expect(actor.getSnapshot().context.projectiles).toEqual([
      { id: expect.any(String), atkIdx: 1, defIdx: 0, moveType: "fire" },
    ]);
    await vi.advanceTimersByTimeAsync(95);
    expect(actor.getSnapshot().context.projectiles).toEqual([]);
  });

  it("daño: sacudida del defensor, popup 900 ms, y sacudida de pantalla solo con crítico o súper eficaz", async () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    let ctx = actor.getSnapshot().context;
    expect(ctx.anim).toEqual(["", "hit-shake"]);
    expect(ctx.damagePopups).toHaveLength(1);
    expect(ctx.shake).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    expect(actor.getSnapshot().context.anim).toEqual(["", ""]);
    expect(actor.getSnapshot().context.damagePopups).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(actor.getSnapshot().context.damagePopups).toEqual([]);

    actor.send({ type: "fx.play", step: damage({ isCrit: true }), speed: 1 });
    expect(actor.getSnapshot().context.shake).toBe(true);
    await vi.advanceTimersByTimeAsync(350);
    ctx = actor.getSnapshot().context;
    expect(ctx.shake).toBe(false);
  });

  it("popup de estado dura 1200 ms", async () => {
    const actor = makeActor();
    actor.send({
      type: "fx.play",
      step: {
        type: "status",
        attackerIdx: 0,
        targetIdx: 1,
        moveName: "x",
        payload: { subType: "ailment", name: "burn" },
      },
      speed: 1,
    });
    expect(actor.getSnapshot().context.statusPopups).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1200);
    expect(actor.getSnapshot().context.statusPopups).toEqual([]);
  });

  it("faint deja la clase hasta el paso end, que limpia todo", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: { type: "faint", faintedIdx: 1 }, speed: 1 });
    expect(actor.getSnapshot().context.anim).toEqual(["", "faint-slide"]);
    actor.send({ type: "fx.play", step: { type: "end", winnerIdx: 0 }, speed: 1 });
    expect(actor.getSnapshot().context.anim).toEqual(["", ""]);
  });

  it("ids deterministas y únicos para efectos simultáneos", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    const ids = actor.getSnapshot().context.damagePopups.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("detener el actor cancela los temporizadores pendientes (nada tras la batalla)", async () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage({ isCrit: true }), speed: 1 });
    actor.stop();
    const before = actor.getSnapshot().context;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(actor.getSnapshot().context).toEqual(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});
