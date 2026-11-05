import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";

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
  const idA = useGameStore((s) => s.players.player1.chosenId);
  const idB = useGameStore((s) => s.players.player2.chosenId);

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

/** True when both fighters have been selected and loaded. */
export function useBothReady(): boolean {
  const p1 = useGameStore((s) => s.players.player1.chosenId);
  const p2 = useGameStore((s) => s.players.player2.chosenId);
  return p1 !== null && p2 !== null;
}
