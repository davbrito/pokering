import type { BattleStep, MoveInfo } from "./types";

/** Datos fijos de una batalla, conocidos antes de reproducirla. */
export interface BattleSetup {
  maxHp: readonly [number, number];
  moves: readonly [readonly MoveInfo[], readonly MoveInfo[]];
}

/** Lo que la vista necesita mostrar en un instante de la reproducción (HP y PP por luchador). */
export interface BattleViewState {
  hp: readonly [number, number];
  pp: readonly [readonly number[], readonly number[]];
}

export function initialBattleViewState(setup: BattleSetup): BattleViewState {
  return {
    hp: [setup.maxHp[0], setup.maxHp[1]],
    pp: [setup.moves[0].map((m) => m.pp), setup.moves[1].map((m) => m.pp)],
  };
}

function withHp(state: BattleViewState, idx: number, hp: number): BattleViewState {
  return { ...state, hp: idx === 0 ? [hp, state.hp[1]] : [state.hp[0], hp] };
}

/**
 * Reducer puro: aplica un paso a HP/PP y devuelve un estado nuevo (nunca muta `state`).
 * `moves` se necesita para localizar qué movimiento gasta PP en `use-move`.
 */
export function applyStep(state: BattleViewState, step: BattleStep, setup: BattleSetup): BattleViewState {
  switch (step.type) {
    case "damage":
      return withHp(state, step.targetIdx, step.currentHp);
    case "status":
      return step.payload.subType === "heal" ? withHp(state, step.targetIdx, step.payload.currentHp) : state;
    case "passive":
      return step.payload.subType === "restriction" ? state : withHp(state, step.targetIdx, step.payload.currentHp);
    case "use-move": {
      const idx = step.attackerIdx;
      const moveIdx = setup.moves[idx].findIndex((m) => m.name === step.move.name);
      const current = state.pp[idx][moveIdx];
      if (moveIdx === -1 || current === undefined || current <= 0) return state;
      const pp = state.pp[idx].map((v, i) => (i === moveIdx ? v - 1 : v));
      return { ...state, pp: idx === 0 ? [pp, state.pp[1]] : [state.pp[0], pp] };
    }
    default:
      return state;
  }
}

/** Estado visible tras reproducir `steps[0..stepIdx]` (inclusive). */
export function deriveBattleViewState(
  setup: BattleSetup,
  steps: readonly BattleStep[],
  stepIdx: number,
): BattleViewState {
  let state = initialBattleViewState(setup);
  const last = Math.min(stepIdx, steps.length - 1);
  for (let i = 0; i <= last; i++) state = applyStep(state, steps[i], setup);
  return state;
}

/** Duración base (ms, a velocidad 1x) que permanece en pantalla cada paso. */
export function stepDuration(step: BattleStep): number {
  switch (step.type) {
    case "start":
      return 2200;
    case "miss":
      return 1500;
    case "faint":
      return 2000;
    case "end":
      return 2500;
    case "status":
      return 1700;
    case "passive":
      return 1500;
    case "use-move":
      return step.move.damageClass === "special" ? 2000 : 1800;
    case "damage":
      return 600;
    default:
      return 1800;
  }
}
