import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import type { BattleStep } from "./types";

// ─── Store ───────────────────────────────────────────────────────────────────
// Action-Driven Logic: state and actions coexist in a single store.
// Selectors give you fine-grained re-render control.

type BattlePhase = "selection" | "battle" | "result";

interface BattleState {
  phase: BattlePhase;
  logs: BattleStep[];
  currentStepIdx: number;
  playbackSpeed: number;
  isPaused: boolean;
  isLoadingMoves: boolean;
}

interface PlayerState {
  chosenId: number | null;
  level: number;
  maxHealth: number;
  currentHp: number;
}

interface PlayersState {
  player1: PlayerState;
  player2: PlayerState;
}

interface GameState {
  searchQuery: string;
  activeTab: string;
  /** Idioma para nombres de Pokémon (código ISO, ej. "es", "ja", "fr") */
  pokemonLanguage: string;
  players: PlayersState;
  battle: BattleState;
}

interface GameActions {
  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: string) => void;
  setPokemonLanguage: (lang: string) => void;
  selectPokemon: (slot: number, id: number) => void;
  setLevel: (slot: number, level: number) => void;
  setBattlePhase: (phase: BattlePhase) => void;
  setBattleLogs: (logs: BattleStep[]) => void;
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
  players: {
    player1: { chosenId: null, level: 50, maxHealth: 100, currentHp: 100 },
    player2: { chosenId: null, level: 50, maxHealth: 100, currentHp: 100 },
  },
  battle: {
    phase: "selection",
    logs: [],
    currentStepIdx: 0,
    playbackSpeed: 1,
    isPaused: false,
    isLoadingMoves: false,
  },

  // ── Actions ──
  setSearchQuery: (q) => set({ searchQuery: q }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setPokemonLanguage: (lang) => set({ pokemonLanguage: lang }),

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

  setBattlePhase: (phase) => set((s) => ({ battle: { ...s.battle, phase } })),

  setBattleLogs: (logs) => set((s) => ({ battle: { ...s.battle, logs } })),

  setCurrentStepIdx: (idx) => set((s) => ({ battle: { ...s.battle, currentStepIdx: idx } })),

  setPlaybackSpeed: (speed) => set((s) => ({ battle: { ...s.battle, playbackSpeed: speed } })),

  setIsPaused: (paused) => set((s) => ({ battle: { ...s.battle, isPaused: paused } })),

  setIsLoadingMoves: (loading) => set((s) => ({ battle: { ...s.battle, isLoadingMoves: loading } })),

  setMaxHealths: (hps) =>
    set((s) => ({
      players: {
        ...s.players,
        player1: { ...s.players.player1, maxHealth: hps[0] },
        player2: { ...s.players.player2, maxHealth: hps[1] },
      },
    })),

  setCurrentHps: (hps) =>
    set((s) => ({
      players: {
        ...s.players,
        player1: { ...s.players.player1, currentHp: hps[0] },
        player2: { ...s.players.player2, currentHp: hps[1] },
      },
    })),

  resetBattle: () =>
    set((s) => ({
      players: {
        ...s.players,
        player1: { ...s.players.player1, maxHealth: 100, currentHp: 100 },
        player2: { ...s.players.player2, maxHealth: 100, currentHp: 100 },
      },
      battle: {
        phase: "selection",
        logs: [],
        currentStepIdx: 0,
        playbackSpeed: 1,
        isPaused: false,
        isLoadingMoves: false,
      },
    })),
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
