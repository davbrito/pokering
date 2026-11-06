import { describe, expect, it } from "vitest";
import { createActor, fromCallback } from "xstate";
import type { ClockTickEvent } from "#/game/clock.ts";
import { advanceEffects, fxView, INITIAL_FX, playStep, stageFxMachine } from "#/game/stage-fx-machine.ts";
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

/** Reloj controlado: `tick(dt)` solo llega mientras el actor `fx` está en `running`. */
let tick: (dt: number) => void = () => {};
const fakeClock = fromCallback<ClockTickEvent>(({ sendBack }) => {
  tick = (dt) => sendBack({ type: "clock.tick", dt });
  return () => {
    tick = () => {};
  };
});

function makeActor() {
  return createActor(stageFxMachine.provide({ actors: { clock: fakeClock } })).start();
}
const ctx = (actor: ReturnType<typeof makeActor>) => actor.getSnapshot().context;

describe("stageFxMachine", () => {
  it("empieza sin efectos", () => {
    expect(ctx(makeActor())).toEqual(INITIAL_FX);
  });

  it("embestida física: clase en el atacante que se limpia a los 450 ms de paso", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: { type: "use-move", attackerIdx: 0, move: tackle }, speed: 1 });
    expect(ctx(actor).anim).toEqual(["lunge-right", ""]);
    tick(449);
    expect(ctx(actor).anim[0]).toBe("lunge-right");
    tick(1);
    expect(ctx(actor).anim).toEqual(["", ""]);
    expect(ctx(actor).pending).toEqual([]);
  });

  it("movimiento especial: proyectil que vence a los 380 ms de paso", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: { type: "use-move", attackerIdx: 1, move: ember }, speed: 1 });
    expect(ctx(actor).projectiles).toEqual([{ id: expect.any(String), atkIdx: 1, defIdx: 0, moveType: "fire" }]);
    tick(380);
    expect(ctx(actor).projectiles).toEqual([]);
  });

  it("daño: sacudida del defensor, popup 900 ms y sacudida de pantalla solo con crítico o súper eficaz", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    expect(ctx(actor).anim).toEqual(["", "hit-shake"]);
    expect(ctx(actor).damagePopups).toHaveLength(1);
    expect(ctx(actor).shake).toBe(false);
    tick(400);
    expect(ctx(actor).anim).toEqual(["", ""]);
    tick(500);
    expect(ctx(actor).damagePopups).toEqual([]);

    actor.send({ type: "fx.play", step: damage({ eff: 2 }), speed: 1 });
    expect(ctx(actor).shake).toBe(true);
    tick(350);
    expect(ctx(actor).shake).toBe(false);
  });

  it("el temporizador de impacto no borra la animación de derrota (a ninguna velocidad)", () => {
    for (const speed of [1, 2, 4] as const) {
      const actor = makeActor();
      actor.send({ type: "fx.play", step: damage(), speed });
      actor.send({ type: "fx.play", step: { type: "faint", faintedIdx: 1 }, speed });
      tick(10_000 / speed); // vencen todos los efectos pendientes
      expect(ctx(actor).anim).toEqual(["", "faint-slide"]);
    }
  });

  it("una embestida pendiente tampoco pisa una animación posterior", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: { type: "use-move", attackerIdx: 0, move: tackle }, speed: 1 });
    actor.send({ type: "fx.play", step: damage({ targetIdx: 0 }), speed: 1 }); // el atacante recibe daño: hit-shake
    tick(450);
    expect(ctx(actor).anim).toEqual(["", ""]); // vence el hit-shake (400) y la embestida no lo pisa de vuelta
  });

  it("popup de estado dura 1200 ms de paso", () => {
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
    expect(ctx(actor).statusPopups).toHaveLength(1);
    tick(1199);
    expect(ctx(actor).statusPopups).toHaveLength(1);
    tick(1);
    expect(ctx(actor).statusPopups).toEqual([]);
  });

  it("todas las duraciones se escalan con la velocidad", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage({ isCrit: true }), speed: 4 });
    tick(225); // 900 ms de paso a 4x
    expect(ctx(actor).damagePopups).toEqual([]);
    expect(ctx(actor).shake).toBe(false);
    expect(ctx(actor).anim).toEqual(["", ""]);
  });

  it("cambiar la velocidad con playback.setSpeed reescala lo que queda", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    tick(450); // 450 de 900
    actor.send({ type: "playback.setSpeed", speed: 2 });
    tick(224);
    expect(ctx(actor).damagePopups).toHaveLength(1);
    tick(1); // 225 reales a 2x = 450 de paso
    expect(ctx(actor).damagePopups).toEqual([]);
  });

  it("pausar detiene los efectos y reanudar los continúa donde iban", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    tick(500);
    actor.send({ type: "playback.pause" });
    tick(60_000); // el reloj está detenido
    expect(ctx(actor).damagePopups).toHaveLength(1);
    actor.send({ type: "playback.resume" });
    tick(399);
    expect(ctx(actor).damagePopups).toHaveLength(1);
    tick(1);
    expect(ctx(actor).damagePopups).toEqual([]);
  });

  it("faint deja la clase hasta el paso end, que limpia todo", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: { type: "faint", faintedIdx: 1 }, speed: 1 });
    expect(ctx(actor).anim).toEqual(["", "faint-slide"]);
    actor.send({ type: "fx.play", step: { type: "end", winnerIdx: 0 }, speed: 1 });
    expect(ctx(actor).anim).toEqual(["", ""]);
  });

  it("ids deterministas y únicos para efectos simultáneos", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    actor.send({ type: "fx.play", step: damage(), speed: 1 });
    expect(new Set(ctx(actor).damagePopups.map((p) => p.id)).size).toBe(2);
  });

  it("detener el actor detiene el reloj y descarta los efectos pendientes", () => {
    const actor = makeActor();
    actor.send({ type: "fx.play", step: damage({ isCrit: true }), speed: 1 });
    const before = ctx(actor);
    actor.stop();
    tick(5_000); // el cleanup del reloj reemplazó `tick` por un no-op
    expect(ctx(actor)).toEqual(before);
  });
});

describe("funciones puras", () => {
  it("playStep y advanceEffects no mutan su entrada", () => {
    const frozen = Object.freeze({ ...INITIAL_FX });
    const played = playStep(frozen, damage(), 1);
    expect(frozen).toEqual(INITIAL_FX);
    const advanced = advanceEffects(played, 10_000);
    expect(played.pending.length).toBeGreaterThan(0);
    expect(advanced.pending).toEqual([]);
  });

  it("fxView conserva las referencias visibles mientras solo avanza el tiempo (sin renders de más)", () => {
    const played = playStep(INITIAL_FX, damage(), 1);
    const before = fxView(played);
    const after = fxView(advanceEffects(played, 16)); // nada vence aún: solo cambia `pending`
    expect(after.anim).toBe(before.anim);
    expect(after.damagePopups).toBe(before.damagePopups);
    expect(after.projectiles).toBe(before.projectiles);
    expect(after.statusPopups).toBe(before.statusPopups);
    expect(after.shake).toBe(before.shake);
  });
});
