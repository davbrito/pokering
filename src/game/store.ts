import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import type { BattleStep } from "./types";

// ─── Store ───────────────────────────────────────────────────────────────────
// Action-Driven Logic: state and actions coexist in a single store.
// Selectors give you fine-grained re-render control.

interface GameState {
  searchQuery: string;
  activeTab: string;
  /** Idioma para nombres de Pokémon (código ISO, ej. "es", "ja", "fr") */
  pokemonLanguage: string;
  /** Raw IDs; resolved via useChosenPokemon() + React Query */
  chosenIds: [number | null, number | null];
  battlePhase: "selection" | "battle" | "result";
  battleSteps: BattleStep[];
  currentStepIdx: number;
  playbackSpeed: number;
  isPaused: boolean;
  isLoadingMoves: boolean;
  maxHealths: [number, number];
  currentHps: [number, number];
}

interface GameActions {
  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: string) => void;
  setPokemonLanguage: (lang: string) => void;
  selectPokemon: (slot: number, id: number) => void;
  setBattlePhase: (phase: "selection" | "battle" | "result") => void;
  setBattleSteps: (steps: BattleStep[]) => void;
  setCurrentStepIdx: (idx: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPaused: (paused: boolean) => void;
  setIsLoadingMoves: (loading: boolean) => void;
  setMaxHealths: (hps: [number, number]) => void;
  setCurrentHps: (hps: [number, number]) => void;
  resetBattle: () => void;
}

export const useGameStore = create<GameState & GameActions>()((set) => ({
  // ── State ──
  searchQuery: "",
  activeTab: "all",
  pokemonLanguage: "es",
  chosenIds: [null, null],
  battlePhase: "selection",
  battleSteps: [],
  currentStepIdx: 0,
  playbackSpeed: 1,
  isPaused: false,
  isLoadingMoves: false,
  maxHealths: [100, 100],
  currentHps: [100, 100],

  // ── Actions ──
  setSearchQuery: (q) => set({ searchQuery: q }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setPokemonLanguage: (lang) => set({ pokemonLanguage: lang }),

  selectPokemon: (slot, id) =>
    set((state) => {
      const next: [number | null, number | null] = [...state.chosenIds];
      next[slot] = id;
      return { chosenIds: next };
    }),

  setBattlePhase: (phase) => set({ battlePhase: phase }),

  setBattleSteps: (steps) => set({ battleSteps: steps }),

  setCurrentStepIdx: (idx) => set({ currentStepIdx: idx }),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setIsPaused: (paused) => set({ isPaused: paused }),

  setIsLoadingMoves: (loading) => set({ isLoadingMoves: loading }),

  setMaxHealths: (hps) => set({ maxHealths: hps }),

  setCurrentHps: (hps) => set({ currentHps: hps }),

  resetBattle: () =>
    set({
      battlePhase: "selection",
      battleSteps: [],
      currentStepIdx: 0,
      playbackSpeed: 1,
      isPaused: false,
      maxHealths: [100, 100],
      currentHps: [100, 100],
    }),
}));

// ─── React Query bridge ──────────────────────────────────────────────────────
// Fetch PokemonDetail from the API whenever chosenIds change.

export function useChosenPokemon(): {
  chosen: [PokemonDetail | null, PokemonDetail | null];
  chosenLoading: [boolean, boolean];
} {
  const [idA, idB] = useGameStore((s) => s.chosenIds);

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
  const ids = useGameStore((s) => s.chosenIds);
  return ids[0] !== null && ids[1] !== null;
}
