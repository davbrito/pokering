import { type QueryClient, useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import { fetchPokemonMovePool, generateBattleSteps, getStatsObject, scaleStatsArrayByLevel } from "./combat";
import { selectBattleMoves } from "./combat/moves";
import { createGameContext, getGameContext, runWithGameContext } from "./context";
import { randomSeed } from "./rng";
import type { BattleStep, MoveInfo } from "./types";

// ─── Store ───────────────────────────────────────────────────────────────────
// Action-Driven Logic: state and actions coexist in a single store.
// Selectors give you fine-grained re-render control.

type BattlePhase = "selection" | "battle" | "result";

interface BattleState {
  phase: BattlePhase;
  logs: BattleStep[];
  /** Semilla de la batalla actual, para depuración. Por sí sola no reproduce la batalla (movimientos y niveles vienen de fuera). */
  seed: number | null;
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
  moves: MoveInfo[];
  pp: number[];
}

interface PlayersState {
  player1: PlayerState;
  player2: PlayerState;
}

interface GameState {
  searchQuery: string;
  activeTab: string;
  players: PlayersState;
  battle: BattleState;
}

interface GameActions {
  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: string) => void;
  selectPokemon: (slot: number, id: number) => void;
  setLevel: (slot: number, level: number) => void;
  setBattlePhase: (phase: BattlePhase) => void;
  setBattleLogs: (logs: BattleStep[]) => void;
  setBattleSeed: (seed: number | null) => void;
  setCurrentStepIdx: (idx: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPaused: (paused: boolean) => void;
  setCurrentHps: (hps: [number, number]) => void;
  setPlayerPp: (slot: number, pp: number[]) => void;
  resetBattle: () => void;
  startBattle(queryClient: QueryClient): Promise<void>;
}

export const useGameStore = create<GameState & GameActions>()((set, get) => {
  const setLoading = (isLoading: boolean) => set((s) => ({ battle: { ...s.battle, isLoadingMoves: isLoading } }));
  return {
    // ── State ──
    searchQuery: "",

    activeTab: "all",

    players: {
      player1: { chosenId: null, level: 50, maxHealth: 100, currentHp: 100, moves: [], pp: [] },
      player2: { chosenId: null, level: 50, maxHealth: 100, currentHp: 100, moves: [], pp: [] },
    },

    battle: {
      phase: "selection",
      logs: [],
      seed: null,
      currentStepIdx: 0,
      playbackSpeed: 1,
      isPaused: false,
      isLoadingMoves: false,
    },

    // ── Actions ──
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

    setBattlePhase: (phase) => set((s) => ({ battle: { ...s.battle, phase } })),
    setBattleSeed: (seed) => set((s) => ({ battle: { ...s.battle, seed } })),
    setBattleLogs: (logs) => set((s) => ({ battle: { ...s.battle, logs } })),
    setCurrentStepIdx: (idx) => set((s) => ({ battle: { ...s.battle, currentStepIdx: idx } })),
    setPlaybackSpeed: (speed) => set((s) => ({ battle: { ...s.battle, playbackSpeed: speed } })),
    setIsPaused: (paused) => set((s) => ({ battle: { ...s.battle, isPaused: paused } })),

    setPlayerPp: (slot, pp) =>
      set((s) => {
        const key = slot === 0 ? ("player1" as const) : ("player2" as const);
        return { players: { ...s.players, [key]: { ...s.players[key], pp } } };
      }),

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
          player1: { ...s.players.player1, maxHealth: 100, currentHp: 100, moves: [], pp: [] },
          player2: { ...s.players.player2, maxHealth: 100, currentHp: 100, moves: [], pp: [] },
        },
        battle: {
          phase: "selection",
          logs: [],
          seed: null,
          currentStepIdx: 0,
          playbackSpeed: 1,
          isPaused: false,
          isLoadingMoves: false,
        },
        /**
         * Start a battle between two Pokémon.
         * Fetches moves, computes stats, generates battle steps, and transitions to "battle" phase.
         */
      })),

    async startBattle(queryClient: QueryClient): Promise<void> {
      const { setBattleLogs, setBattleSeed, setBattlePhase, setCurrentStepIdx, setIsPaused } = get();
      const { player1, player2 } = get().players;
      if (!player1.chosenId || !player2.chosenId) return;
      const level1 = player1.level;
      const level2 = player2.level;
      const [poke1, poke2] = await Promise.all([
        queryClient.ensureQueryData(pokemonRetrieveOptions({ path: { id: String(player1.chosenId) } })),
        queryClient.ensureQueryData(pokemonRetrieveOptions({ path: { id: String(player2.chosenId) } })),
      ]);

      setLoading(true);
      try {
        // El fetch es async (unctx pierde el contexto tras un await): se hace antes,
        // y toda la parte aleatoria se ejecuta de forma síncrona dentro del contexto.
        const [pool1, pool2] = await Promise.all([
          fetchPokemonMovePool(queryClient, poke1),
          fetchPokemonMovePool(queryClient, poke2),
        ]);

        const s1 = getStatsObject(poke1);
        const s2 = getStatsObject(poke2);
        const seed = randomSeed();
        const { players } = useGameStore.getState();
        const lv1 = level1 ?? players.player1.level;
        const lv2 = level2 ?? players.player2.level;
        const scaled1 = scaleStatsArrayByLevel(poke1.stats, lv1);
        const scaled2 = scaleStatsArrayByLevel(poke2.stats, lv2);
        const mh1 = scaled1.find((s) => s.stat.name === "hp")?.base_stat ?? 100;
        const mh2 = scaled2.find((s) => s.stat.name === "hp")?.base_stat ?? 100;

        const { p1Moves, p2Moves, steps } = runWithGameContext(createGameContext(seed), () => {
          const { rng } = getGameContext();
          const p1Moves = selectBattleMoves(pool1, s1, rng);
          const p2Moves = selectBattleMoves(pool2, s2, rng);
          const steps = generateBattleSteps(
            poke1,
            poke2,
            s1,
            s2,
            mh1,
            mh2,
            p1Moves,
            p2Moves,
            undefined,
            undefined,
            lv1,
            lv2,
            rng,
          );
          return { p1Moves, p2Moves, steps };
        });

        set((state) => ({
          players: {
            ...state.players,
            player1: {
              ...state.players.player1,
              maxHealth: mh1,
              currentHp: mh1,
              moves: p1Moves,
              pp: p1Moves.map((m) => m.pp),
            },
            player2: {
              ...state.players.player2,
              maxHealth: mh2,
              moves: p2Moves,
              pp: p2Moves.map((m) => m.pp),
              currentHp: mh2,
            },
          },
        }));

        setBattleSeed(seed);
        setBattleLogs(steps);
        setCurrentStepIdx(0);
        setIsPaused(false);
        setBattlePhase("battle");
      } finally {
        setLoading(false);
      }
    },
  };
});

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
