import type { QueryClient } from "@tanstack/react-query";
import { createActorContext, useSelector } from "@xstate/react";
import { type ReactNode, useMemo } from "react";
import { type ActorRefFrom, fromPromise, type SnapshotFrom } from "xstate";
import { deriveBattleViewState } from "./battle-state";
import { type GameTag, gameMachine, type Match } from "./machine";
import type { playbackMachine, Speed } from "./playback-machine";
import { type PreparedBattle, prepareBattle } from "./prepare-battle";

export const GameActorContext = createActorContext(gameMachine);

/** Provee la máquina con `prepareBattle` ligado al queryClient (el contexto queda serializable). */
export function GameProvider({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  const logic = useMemo(
    () =>
      gameMachine.provide({
        actors: {
          prepareBattle: fromPromise(({ input }) => prepareBattle(queryClient, input)),
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

/**
 * La batalla en curso. Solo para componentes que se montan cuando existe (fases `battle` y `result`);
 * si no hay, falla de forma visible en vez de inventar valores. El selector devuelve `null` (no lanza)
 * para no romper la suscripción en el instante en que la máquina sale de `match`.
 */
export function useMatch(): Match {
  const match = GameActorContext.useSelector((s) => s.context.match);
  if (!match) throw new Error("invariant: useMatch fuera de una partida en curso");
  return match;
}

/** La batalla ya preparada (setup + pasos). Misma regla que `useMatch`. */
export function usePrepared(): PreparedBattle {
  const prepared = GameActorContext.useSelector((s) => s.context.prepared);
  if (!prepared) throw new Error("invariant: usePrepared antes de que la batalla esté preparada");
  return prepared;
}

type PlaybackSnapshot = SnapshotFrom<typeof playbackMachine>;

/**
 * Lee el actor hijo de reproducción (existe solo en la fase `battle`). Fuera de ella devuelve `fallback`,
 * que es el valor que el padre conserva al terminar (`stepIdx`/`speed` finales).
 */
export function usePlayback<T>(select: (snapshot: PlaybackSnapshot) => T, fallback: T): T {
  // XState no liga el `id` de un invoke con su `src` en los tipos: este es el único cast, y es de tipo, no de valor.
  const playback = GameActorContext.useSelector(
    (s) => s.children.playback as ActorRefFrom<typeof playbackMachine> | undefined,
  );
  const value = useSelector(playback, (snapshot) => (snapshot ? select(snapshot) : undefined));
  return value ?? fallback;
}

export function useStepIdx(): number {
  const last = GameActorContext.useSelector((s) => s.context.stepIdx);
  return usePlayback((snapshot) => snapshot.context.stepIdx, last);
}

export function usePlaybackSpeed(): Speed {
  const last = GameActorContext.useSelector((s) => s.context.speed);
  return usePlayback((snapshot) => snapshot.context.speed, last);
}

/** HP/PP derivados (reducer puro sobre los pasos ya reproducidos); la vista no muta nada. */
export function useBattleView() {
  const prepared = usePrepared();
  const stepIdx = useStepIdx();
  return useMemo(() => deriveBattleViewState(prepared.setup, prepared.steps, stepIdx), [prepared, stepIdx]);
}
