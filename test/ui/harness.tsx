import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { fromPromise } from "xstate";
import { pokemonRetrieveOptions } from "#/api/pokeapi/@tanstack/react-query.gen.ts";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { BattleResult } from "#/game/components/BattleResult.tsx";
import { BattleStage } from "#/game/components/BattleStage.tsx";
import { GameControls } from "#/game/components/GameControls.tsx";
import { GameActorContext, useGamePhase } from "#/game/game-actor.tsx";
import { gameMachine } from "#/game/machine.ts";
import type { PrepareBattleInput, PreparedBattle } from "#/game/prepare-battle.ts";
import { useGameStore } from "#/game/store.ts";
import type { BattleStep, MoveInfo } from "#/game/types.ts";

const tackle: MoveInfo = { name: "tackle", type: "normal", accuracy: 100, pp: 5, damageClass: "physical", power: 40 };

export const steps: BattleStep[] = [
  { type: "start" },
  { type: "use-move", attackerIdx: 0, move: tackle },
  { type: "damage", targetIdx: 1, damage: 30, isCrit: false, eff: 1, currentHp: 0 },
  { type: "end", winnerIdx: 0 },
];
export const prepared: PreparedBattle = { setup: { maxHp: [50, 30], moves: [[tackle], [tackle]] }, steps };

export function makePokemon(id: number, name: string): PokemonDetail {
  const stats = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"].map((stat) => ({
    stat: { name: stat, url: "" },
    base_stat: 60 + id,
    effort: 0,
  }));
  return {
    id,
    name,
    species: { name, url: "" },
    types: [{ slot: 1, type: { name: "normal", url: "" } }],
    stats,
    moves: [],
    sprites: { front_default: `${name}.png`, other: {} },
    height: 10,
    weight: 100,
  } as unknown as PokemonDetail;
}

/** Elige dos luchadores en la pantalla de selección (el store solo guarda la selección). */
export function chooseFighters() {
  const store = useGameStore.getState();
  store.selectPokemon(0, 1);
  store.selectPokemon(1, 4);
}

export function resetSelection() {
  useGameStore.setState({
    players: { player1: { chosenId: null, level: 50 }, player2: { chosenId: null, level: 50 } },
  });
}

/** Promesa que se resuelve o rechaza a mano, para observar la fase `loading`. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Deja correr promesas y temporizadores simulados (la UI se actualiza dentro de `act`). */
export const advance = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function Phase() {
  return <output data-testid="phase">{useGamePhase()}</output>;
}

/**
 * Monta la UI del juego con la máquina real; solo `prepareBattle` se sustituye (sin red). El reloj es el de
 * las máquinas: se controla con `vi.useFakeTimers()`.
 */
export function renderGame(prepare: (input: PrepareBattleInput) => Promise<PreparedBattle>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(pokemonRetrieveOptions({ path: { id: "1" } }).queryKey, makePokemon(1, "bulbasaur"));
  queryClient.setQueryData(pokemonRetrieveOptions({ path: { id: "4" } }).queryKey, makePokemon(4, "charmander"));

  const logic = gameMachine.provide({ actors: { prepareBattle: fromPromise(({ input }) => prepare(input)) } });
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <GameActorContext.Provider logic={logic}>{children}</GameActorContext.Provider>
    </QueryClientProvider>
  );
  return render(
    wrap(
      <>
        <Phase />
        <GameControls />
        <BattleStage />
        <BattleResult />
      </>,
    ),
  );
}
