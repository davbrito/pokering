import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import type { BattleStep } from "./types";

interface GameState {
  modalOpen: boolean;
  activeSlot: number;
  searchQuery: string;
  activeTab: string;
  chosen: [PokemonDetail | null, PokemonDetail | null];
  chosenLoading: [boolean, boolean];
  battlePhase: "selection" | "battle" | "result";
  battleSteps: BattleStep[];
  currentStepIdx: number;
  playbackSpeed: number;
  isPaused: boolean;
  maxHealths: [number, number];
  currentHps: [number, number];
}

interface GameActions {
  setModalOpen: (open: boolean) => void;
  setActiveSlot: (slot: number) => void;
  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: string) => void;
  selectPokemon: (slot: number, id: number) => Promise<void>;
  setBattlePhase: (phase: "selection" | "battle" | "result") => void;
  setBattleSteps: (steps: BattleStep[]) => void;
  setCurrentStepIdx: (idx: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPaused: (paused: boolean) => void;
  setMaxHealths: (hps: [number, number]) => void;
  setCurrentHps: (hps: [number, number]) => void;
  resetBattle: () => void;
}

const GameContext = createContext<GameState | null>(null);
const GameActionsContext = createContext<GameActions | null>(null);

export function GameProvider(props: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [chosenIds, setChosenIds] = useState<[number | null, number | null]>([
    null,
    null,
  ]);
  const [battlePhase, setBattlePhase] = useState<
    "selection" | "battle" | "result"
  >("selection");
  const [battleSteps, setBattleSteps] = useState<BattleStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [maxHealths, setMaxHealths] = useState<[number, number]>([100, 100]);
  const [currentHps, setCurrentHps] = useState<[number, number]>([100, 100]);
  const [chosenAId, chosenBId] = chosenIds;

  const chosenAQuery = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(chosenAId) } }),
    enabled: chosenAId !== null,
  });
  const chosenBQuery = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(chosenBId) } }),
    enabled: chosenBId !== null,
  });

  const chosen: [PokemonDetail | null, PokemonDetail | null] = [
    chosenAQuery.data || null,
    chosenBQuery.data || null,
  ];
  const chosenLoading: [boolean, boolean] = [
    chosenAQuery.isLoading,
    chosenBQuery.isLoading,
  ];

  const selectPokemonFn = async (slot: number, id: number) => {
    setChosenIds((prev) => {
      const next: [number | null, number | null] = [...prev];
      next[slot] = id;
      return next;
    });
  };

  const resetBattleFn = () => {
    setBattlePhase("selection");
    setBattleSteps([]);
    setCurrentStepIdx(0);
    setPlaybackSpeed(1);
    setIsPaused(false);
    setMaxHealths([100, 100]);
    setCurrentHps([100, 100]);
  };

  const state: GameState = {
    modalOpen,
    activeSlot,
    searchQuery,
    activeTab,
    chosen,
    chosenLoading,
    battlePhase,
    battleSteps,
    currentStepIdx,
    playbackSpeed,
    isPaused,
    maxHealths,
    currentHps,
  };

  const actions: GameActions = {
    setModalOpen,
    setActiveSlot,
    setSearchQuery,
    setActiveTab,
    selectPokemon: selectPokemonFn,
    setBattlePhase,
    setBattleSteps,
    setCurrentStepIdx,
    setPlaybackSpeed,
    setIsPaused,
    setMaxHealths,
    setCurrentHps,
    resetBattle: resetBattleFn,
  };

  return (
    <GameContext.Provider value={state}>
      <GameActionsContext.Provider value={actions}>
        {props.children}
      </GameActionsContext.Provider>
    </GameContext.Provider>
  );
}

export function useGame(): GameState {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export function useGameActions(): GameActions {
  const ctx = useContext(GameActionsContext);
  if (!ctx) throw new Error("useGameActions must be used within GameProvider");
  return ctx;
}

// Convenience hooks for commonly used state
export function useBothReady(): boolean {
  const { chosen } = useGame();
  return chosen[0] !== null && chosen[1] !== null;
}
