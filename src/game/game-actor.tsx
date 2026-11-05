import { createActorContext } from "@xstate/react";
import { useMemo } from "react";
import { deriveBattleViewState } from "./battle-state";
import { gameMachine } from "./machine";

export const GameActorContext = createActorContext(gameMachine);

export type GamePhase = "selection" | "loading" | "battle" | "result" | "error";

export function useGamePhase(): GamePhase {
  return GameActorContext.useSelector((s) => {
    if (s.matches("loading")) return "loading";
    if (s.matches("battle")) return "battle";
    if (s.matches("result")) return "result";
    if (s.matches("error")) return "error";
    return "selection";
  });
}

/** HP/PP derivados (reducer puro sobre los pasos ya reproducidos); la vista no muta nada. */
export function useBattleView() {
  const setup = GameActorContext.useSelector((s) => s.context.setup);
  const logs = GameActorContext.useSelector((s) => s.context.logs);
  const stepIdx = GameActorContext.useSelector((s) => s.context.stepIdx);
  return useMemo(() => (setup ? deriveBattleViewState(setup, logs, stepIdx) : null), [setup, logs, stepIdx]);
}
