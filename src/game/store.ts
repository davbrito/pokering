import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { create } from "zustand";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import { GameActorContext, useGamePhase } from "./game-actor";
import type { Fighter } from "./prepare-battle";

// ─── Store ───────────────────────────────────────────────────────────────────
// Solo estado de la pantalla de selección (búsqueda, pestaña, luchadores elegidos).
// El flujo de la partida vive en `gameMachine` (machine.ts).

interface PlayerSelection {
  chosenId: number | null;
  level: number;
}

interface GameState {
  searchQuery: string;
  activeTab: string;
  players: { player1: PlayerSelection; player2: PlayerSelection };
}

interface GameActions {
  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: string) => void;
  selectPokemon: (slot: number, id: number) => void;
  setLevel: (slot: number, level: number) => void;
}

export const useGameStore = create<GameState & GameActions>()((set) => ({
  searchQuery: "",
  activeTab: "all",
  players: {
    player1: { chosenId: null, level: 50 },
    player2: { chosenId: null, level: 50 },
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectPokemon: (slot, id) =>
    set((s) => {
      const key = slot === 0 ? ("player1" as const) : ("player2" as const);
      return { players: { ...s.players, [key]: { ...s.players[key], chosenId: id } } };
    }),

  setLevel: (slot, level) =>
    set((s) => {
      const key = slot === 0 ? ("player1" as const) : ("player2" as const);
      return { players: { ...s.players, [key]: { ...s.players[key], level } } };
    }),
}));

// ─── React Query bridge ──────────────────────────────────────────────────────
// Fetch PokemonDetail from the API whenever chosenIds change.

export function useChosenPokemon(): {
  chosen: [PokemonDetail | null, PokemonDetail | null];
  chosenLoading: [boolean, boolean];
} {
  // En selección la fuente es el store; desde START en adelante, la máquina (única fuente de verdad).
  const inSelection = useGamePhase() === "selection";
  const fighters = GameActorContext.useSelector((s) => s.context.match?.fighters ?? null);
  const selA = useGameStore((s) => s.players.player1.chosenId);
  const selB = useGameStore((s) => s.players.player2.chosenId);
  const idA = inSelection || !fighters ? selA : fighters[0].id;
  const idB = inSelection || !fighters ? selB : fighters[1].id;

  const qA = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(idA) } }),
    enabled: idA !== null,
  });
  const qB = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(idB) } }),
    enabled: idB !== null,
  });

  return {
    chosen: [qA.data ?? null, qB.data ?? null],
    chosenLoading: [qA.isLoading, qB.isLoading],
  };
}

/** Luchadores elegidos en la pantalla de selección, o null si falta alguno. */
export function useSelectedFighters(): readonly [Fighter, Fighter] | null {
  const id1 = useGameStore((s) => s.players.player1.chosenId);
  const id2 = useGameStore((s) => s.players.player2.chosenId);
  const level1 = useGameStore((s) => s.players.player1.level);
  const level2 = useGameStore((s) => s.players.player2.level);
  return useMemo(
    () =>
      id1 === null || id2 === null
        ? null
        : ([
            { id: id1, level: level1 },
            { id: id2, level: level2 },
          ] as const),
    [id1, id2, level1, level2],
  );
}
