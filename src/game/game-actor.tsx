import type { QueryClient } from "@tanstack/react-query";
import { createActorContext } from "@xstate/react";
import { type ReactNode, useMemo } from "react";
import { fromPromise } from "xstate";
import { deriveBattleViewState } from "./battle-state";
import { gameMachine } from "./machine";
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

export type GamePhase = "selection" | "loading" | "battle" | "result" | "error";

export function useGamePhase(): GamePhase {
  // El estado raíz ya es la fase: "selection" | "loading" | "battle" (con subestado) | "result" | "error".
  return GameActorContext.useSelector((s) =>
    typeof s.value === "string" ? s.value : Object.keys(s.value)[0],
  ) as GamePhase;
}

/** HP/PP derivados (reducer puro sobre los pasos ya reproducidos); la vista no muta nada. */
export function useBattleView() {
  const setup = GameActorContext.useSelector((s) => s.context.setup);
  const logs = GameActorContext.useSelector((s) => s.context.logs);
  const stepIdx = GameActorContext.useSelector((s) => s.context.stepIdx);
  return useMemo(() => (setup ? deriveBattleViewState(setup, logs, stepIdx) : null), [setup, logs, stepIdx]);
}
