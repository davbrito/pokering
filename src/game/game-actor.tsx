import type { QueryClient } from "@tanstack/react-query";
import { createActorContext } from "@xstate/react";
import { type ReactNode, useMemo } from "react";
import { fromPromise } from "xstate";
import { deriveBattleViewState } from "./battle-state";
import { type GameTag, gameMachine } from "./machine";
import { prepareBattle } from "./prepare-battle";

export const GameActorContext = createActorContext(gameMachine);

/** Provee la máquina con `prepareBattle` ligado al queryClient (el contexto queda serializable). */
export function GameProvider({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  const logic = useMemo(
    () =>
      gameMachine.provide({
        actors: {
          prepareBattle: fromPromise(({ input }) =>
            input ? prepareBattle(queryClient, input) : Promise.reject(new Error("no battle requested")),
          ),
        },
      }),
    [queryClient],
  );
  return <GameActorContext.Provider logic={logic}>{children}</GameActorContext.Provider>;
}

const PHASES = ["loading", "battle", "result", "error", "selection"] as const satisfies readonly GameTag[];
export type GamePhase = (typeof PHASES)[number];

export function useGamePhase(): GamePhase {
  // Cada fase tiene su tag (tipado en `setup`); "selection" es la última.
  return GameActorContext.useSelector((s) => PHASES.find((tag) => s.hasTag(tag)) ?? "selection");
}

/** HP/PP derivados (reducer puro sobre los pasos ya reproducidos); la vista no muta nada. */
export function useBattleView() {
  const prepared = GameActorContext.useSelector((s) => s.context.prepared);
  const stepIdx = GameActorContext.useSelector((s) => s.context.stepIdx);
  return useMemo(
    () => (prepared ? deriveBattleViewState(prepared.setup, prepared.steps, stepIdx) : null),
    [prepared, stepIdx],
  );
}
