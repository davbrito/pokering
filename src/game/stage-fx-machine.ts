import { assign, setup } from "xstate";
import { type ClockTickEvent, clock } from "./clock";
import type { Speed } from "./playback-machine";
import type { BattleDamageStep, BattleStatusStep, BattleStep } from "./types";

// Efectos visuales del escenario (clases de animación, popups, proyectiles). Su tiempo corre con el mismo
// reloj que la reproducción: se detiene al pausar y avanza a la velocidad elegida. Al salir de `playback`
// el actor se detiene y con él el reloj y todos los efectos pendientes.

export interface DamagePopupData {
  id: string;
  defIdx: number;
  step: BattleDamageStep;
}

export interface StatusPopupData {
  id: string;
  targetIdx: number;
  step: BattleStatusStep;
}

/** Proyectil lógico; la vista calcula la geometría (posiciones DOM) al montarlo. */
export interface ProjectileData {
  id: string;
  atkIdx: number;
  defIdx: number;
  moveType: string;
}

/** Qué deshacer cuando vence un efecto. */
export type FxEffect =
  /** Solo limpia si la clase sigue siendo la que puso el efecto (no pisa una animación posterior). */
  | { kind: "anim"; idx: number; cls: string }
  | { kind: "shake" }
  | { kind: "damagePopup"; id: string }
  | { kind: "statusPopup"; id: string }
  | { kind: "projectile"; id: string };

export interface PendingEffect {
  /** Tiempo que le queda, en ms a velocidad 1x. */
  remaining: number;
  effect: FxEffect;
}

export interface FxContext {
  /** Clase de animación de cada luchador ("" = ninguna). */
  anim: readonly [string, string];
  shake: boolean;
  damagePopups: readonly DamagePopupData[];
  statusPopups: readonly StatusPopupData[];
  projectiles: readonly ProjectileData[];
  pending: readonly PendingEffect[];
  speed: Speed;
  /** Contador para ids deterministas (sin `crypto.randomUUID` en las acciones). */
  nextId: number;
}

export type FxEvent =
  /** Orden del padre: reproducir los efectos de un paso a la velocidad indicada. */
  | { type: "fx.play"; step: BattleStep; speed: Speed }
  | { type: "playback.pause" }
  | { type: "playback.resume" }
  | { type: "playback.setSpeed"; speed: Speed };

export const INITIAL_FX: FxContext = {
  anim: ["", ""],
  shake: false,
  damagePopups: [],
  statusPopups: [],
  projectiles: [],
  pending: [],
  speed: 1,
  nextId: 0,
};

function withAnim(anim: readonly [string, string], idx: number, value: string): readonly [string, string] {
  return idx === 0 ? [value, anim[1]] : [anim[0], value];
}

/** Efectos inmediatos de un paso + los que vencerán más tarde. Pura: no toca `context`. */
export function playStep(context: FxContext, step: BattleStep, speed: Speed): FxContext {
  let next = context.nextId;
  let { anim, shake, damagePopups, statusPopups, projectiles } = context;
  const pending: PendingEffect[] = [...context.pending];
  const newId = () => `${next++}`;
  const later = (remaining: number, effect: FxEffect) => pending.push({ remaining, effect });

  if (step.type === "use-move") {
    const atkIdx = step.attackerIdx;
    if (step.move.damageClass === "physical") {
      const cls = atkIdx === 0 ? "lunge-right" : "lunge-left";
      anim = withAnim(withAnim(withAnim(anim, 0, ""), 1, ""), atkIdx, cls);
      later(450, { kind: "anim", idx: atkIdx, cls });
    } else {
      const id = newId();
      projectiles = [...projectiles, { id, atkIdx, defIdx: atkIdx === 0 ? 1 : 0, moveType: step.move.type }];
      later(380, { kind: "projectile", id });
    }
  } else if (step.type === "damage") {
    anim = withAnim(anim, step.targetIdx, "hit-shake");
    later(400, { kind: "anim", idx: step.targetIdx, cls: "hit-shake" });
    if (step.isCrit || step.eff > 1.5) {
      shake = true;
      later(350, { kind: "shake" });
    }
    const id = newId();
    damagePopups = [...damagePopups, { id, defIdx: step.targetIdx, step }];
    later(900, { kind: "damagePopup", id });
  } else if (step.type === "status") {
    const id = newId();
    statusPopups = [...statusPopups, { id, targetIdx: step.targetIdx, step }];
    later(1200, { kind: "statusPopup", id });
  } else if (step.type === "faint") {
    anim = withAnim(anim, step.faintedIdx, "faint-slide");
  } else if (step.type === "end") {
    anim = ["", ""];
  }

  return { anim, shake, damagePopups, statusPopups, projectiles, pending, speed, nextId: next };
}

function expire(context: FxContext, effect: FxEffect): FxContext {
  switch (effect.kind) {
    case "anim":
      return context.anim[effect.idx] === effect.cls
        ? { ...context, anim: withAnim(context.anim, effect.idx, "") }
        : context;
    case "shake":
      return { ...context, shake: false };
    case "damagePopup":
      return { ...context, damagePopups: context.damagePopups.filter((p) => p.id !== effect.id) };
    case "statusPopup":
      return { ...context, statusPopups: context.statusPopups.filter((p) => p.id !== effect.id) };
    case "projectile":
      return { ...context, projectiles: context.projectiles.filter((p) => p.id !== effect.id) };
  }
}

/** Avanza el tiempo de los efectos pendientes (`dt` reales × velocidad) y aplica los que vencen. */
export function advanceEffects(context: FxContext, dt: number): FxContext {
  if (context.pending.length === 0) return context;
  const elapsed = dt * context.speed;
  const still: PendingEffect[] = [];
  let next: FxContext = context;
  for (const p of context.pending) {
    const remaining = p.remaining - elapsed;
    if (remaining > 0) still.push({ ...p, remaining });
    else next = expire(next, p.effect);
  }
  return { ...next, pending: still };
}

export const stageFxMachine = setup({
  types: {
    context: {} as FxContext,
    events: {} as FxEvent | ClockTickEvent,
  },
  actors: { clock },
  actions: {
    play: assign(({ context }, params: { step: BattleStep; speed: Speed }) =>
      playStep(context, params.step, params.speed),
    ),
    setSpeed: assign((_, params: { speed: Speed }) => ({ speed: params.speed })),
    advance: assign(({ context }, params: { dt: number }) => advanceEffects(context, params.dt)),
  },
}).createMachine({
  id: "stageFx",
  initial: "running",
  context: INITIAL_FX,
  on: {
    "fx.play": { actions: { type: "play", params: ({ event }) => ({ step: event.step, speed: event.speed }) } },
    "playback.setSpeed": { actions: { type: "setSpeed", params: ({ event }) => ({ speed: event.speed }) } },
  },
  states: {
    running: {
      invoke: { id: "clock", src: "clock" },
      on: {
        "clock.tick": { actions: { type: "advance", params: ({ event }) => ({ dt: event.dt }) } },
        "playback.pause": "paused",
      },
    },
    paused: { on: { "playback.resume": "running" } },
  },
});

export type StageFxMachine = typeof stageFxMachine;
