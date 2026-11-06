import { assign, enqueueActions, fromCallback, setup } from "xstate";
import type { Speed } from "./playback-machine";
import type { BattleDamageStep, BattleStatusStep, BattleStep } from "./types";

// Efectos visuales del escenario (clases de animación, popups, proyectiles). Los temporizadores son
// actores `fxTimer` que viven mientras viva esta máquina: al salir de `playback` se detienen solos.

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

export interface FxContext {
  /** Clase de animación de cada luchador ("" = ninguna). */
  anim: readonly [string, string];
  shake: boolean;
  damagePopups: readonly DamagePopupData[];
  statusPopups: readonly StatusPopupData[];
  projectiles: readonly ProjectileData[];
  /** Contador para ids deterministas (sin `crypto.randomUUID` en las acciones). */
  nextId: number;
}

/** Qué deshacer cuando vence un temporizador. */
export type FxEffect =
  | { kind: "anim"; idx: number }
  | { kind: "shake" }
  | { kind: "damagePopup"; id: string }
  | { kind: "statusPopup"; id: string }
  | { kind: "projectile"; id: string };

export type FxEvent =
  /** Orden del padre: reproducir los efectos de un paso a la velocidad indicada. */
  | { type: "fx.play"; step: BattleStep; speed: Speed }
  /** Hecho del temporizador: venció. */
  | { type: "fx.expired"; timerId: string; effect: FxEffect };

interface FxTimerInput {
  ms: number;
  timerId: string;
  effect: FxEffect;
}

const fxTimer = fromCallback<FxEvent, FxTimerInput>(({ input, sendBack }) => {
  const id = setTimeout(() => sendBack({ type: "fx.expired", timerId: input.timerId, effect: input.effect }), input.ms);
  return () => clearTimeout(id);
});

export const INITIAL_FX: FxContext = {
  anim: ["", ""],
  shake: false,
  damagePopups: [],
  statusPopups: [],
  projectiles: [],
  nextId: 0,
};

function withAnim(anim: readonly [string, string], idx: number, value: string): readonly [string, string] {
  return idx === 0 ? [value, anim[1]] : [anim[0], value];
}

export const stageFxMachine = setup({
  types: {
    context: {} as FxContext,
    events: {} as FxEvent,
  },
  actors: { fxTimer },
  actions: {
    playStep: enqueueActions(({ context, enqueue }, params: { step: BattleStep; speed: Speed }) => {
      const { step, speed } = params;
      let next = context.nextId;
      let anim = context.anim;
      let shake = context.shake;
      let damagePopups = context.damagePopups;
      let statusPopups = context.statusPopups;
      let projectiles = context.projectiles;

      const later = (ms: number, effect: FxEffect) => {
        const timerId = `fx-${next++}`;
        enqueue.spawnChild("fxTimer", { id: timerId, input: { ms, timerId, effect } });
      };
      const newId = () => `${next++}`;

      if (step.type === "use-move") {
        const atkIdx = step.attackerIdx;
        if (step.move.damageClass === "physical") {
          anim = withAnim(withAnim(anim, 0, ""), 1, "");
          anim = withAnim(anim, atkIdx, atkIdx === 0 ? "lunge-right" : "lunge-left");
          later(450 / speed, { kind: "anim", idx: atkIdx });
        } else {
          const id = newId();
          projectiles = [...projectiles, { id, atkIdx, defIdx: atkIdx === 0 ? 1 : 0, moveType: step.move.type }];
          later(380 / speed, { kind: "projectile", id });
        }
      } else if (step.type === "damage") {
        anim = withAnim(anim, step.targetIdx, "hit-shake");
        later(400, { kind: "anim", idx: step.targetIdx });
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

      enqueue.assign({ anim, shake, damagePopups, statusPopups, projectiles, nextId: next });
    }),
    expire: assign(({ context }, params: { effect: FxEffect }) => {
      const { effect } = params;
      switch (effect.kind) {
        case "anim":
          return { anim: withAnim(context.anim, effect.idx, "") };
        case "shake":
          return { shake: false };
        case "damagePopup":
          return { damagePopups: context.damagePopups.filter((p) => p.id !== effect.id) };
        case "statusPopup":
          return { statusPopups: context.statusPopups.filter((p) => p.id !== effect.id) };
        case "projectile":
          return { projectiles: context.projectiles.filter((p) => p.id !== effect.id) };
      }
    }),
    stopTimer: enqueueActions(({ enqueue }, params: { timerId: string }) => enqueue.stopChild(params.timerId)),
  },
}).createMachine({
  id: "stageFx",
  context: INITIAL_FX,
  on: {
    "fx.play": {
      actions: { type: "playStep", params: ({ event }) => ({ step: event.step, speed: event.speed }) },
    },
    "fx.expired": {
      actions: [
        { type: "expire", params: ({ event }) => ({ effect: event.effect }) },
        { type: "stopTimer", params: ({ event }) => ({ timerId: event.timerId }) },
      ],
    },
  },
});

export type StageFxMachine = typeof stageFxMachine;
