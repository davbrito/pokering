import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { fetchAllPokemon, fetchPokemonByName, fetchTypeData } from "./api";
import type { BattleStep, PokemonDetail, PokemonListItem } from "./types";

interface GameState {
  allPokemon: PokemonListItem[];
  modalOpen: boolean;
  activeSlot: number;
  searchQuery: string;
  activeTab: string;
  typePokemon: PokemonListItem[];
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
  loadAllPokemon: () => Promise<void>;
  loadTypeData: (type: string) => Promise<PokemonListItem[]>;
  setModalOpen: (open: boolean) => void;
  setActiveSlot: (slot: number) => void;
  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: string) => void;
  setTypePokemon: (list: PokemonListItem[]) => void;
  selectPokemon: (slot: number, name: string) => Promise<void>;
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

const typeCache: Record<string, PokemonListItem[]> = {};

export function GameProvider(props: { children: ReactNode }) {
  const [allPokemon, setAllPokemon] = useState<PokemonListItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [typePokemon, setTypePokemon] = useState<PokemonListItem[]>([]);
  const [chosen, setChosen] = useState<
    [PokemonDetail | null, PokemonDetail | null]
  >([null, null]);
  const [chosenLoading, setChosenLoading] = useState<[boolean, boolean]>([
    false,
    false,
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

  const loadAllPokemonFn = useCallback(async () => {
    const data = await fetchAllPokemon();
    setAllPokemon(data);
  }, []);

  const loadTypeDataFn = useCallback(
    async (type: string): Promise<PokemonListItem[]> => {
      if (typeCache[type]) return typeCache[type];
      const data = await fetchTypeData(type);
      typeCache[type] = data;
      return data;
    },
    [],
  );

  const selectPokemonFn = useCallback(async (slot: number, name: string) => {
    setChosenLoading((prev) => {
      const next: [boolean, boolean] = [...prev];
      next[slot] = true;
      return next;
    });
    try {
      const pokemon = await fetchPokemonByName(name);
      setChosen((prev) => {
        const next: [PokemonDetail | null, PokemonDetail | null] = [...prev];
        next[slot] = pokemon;
        return next;
      });
    } finally {
      setChosenLoading((prev) => {
        const next: [boolean, boolean] = [...prev];
        next[slot] = false;
        return next;
      });
    }
  }, []);

  const resetBattleFn = useCallback(() => {
    setBattlePhase("selection");
    setBattleSteps([]);
    setCurrentStepIdx(0);
    setPlaybackSpeed(1);
    setIsPaused(false);
    setMaxHealths([100, 100]);
    setCurrentHps([100, 100]);
  }, []);

  const state: GameState = useMemo(
    () => ({
      allPokemon,
      modalOpen,
      activeSlot,
      searchQuery,
      activeTab,
      typePokemon,
      chosen,
      chosenLoading,
      battlePhase,
      battleSteps,
      currentStepIdx,
      playbackSpeed,
      isPaused,
      maxHealths,
      currentHps,
    }),
    [
      allPokemon,
      modalOpen,
      activeSlot,
      searchQuery,
      activeTab,
      typePokemon,
      chosen,
      chosenLoading,
      battlePhase,
      battleSteps,
      currentStepIdx,
      playbackSpeed,
      isPaused,
      maxHealths,
      currentHps,
    ],
  );

  const actions: GameActions = useMemo(
    () => ({
      loadAllPokemon: loadAllPokemonFn,
      loadTypeData: loadTypeDataFn,
      setModalOpen,
      setActiveSlot,
      setSearchQuery,
      setActiveTab,
      setTypePokemon,
      selectPokemon: selectPokemonFn,
      setBattlePhase,
      setBattleSteps,
      setCurrentStepIdx,
      setPlaybackSpeed,
      setIsPaused,
      setMaxHealths,
      setCurrentHps,
      resetBattle: resetBattleFn,
    }),
    [loadAllPokemonFn, loadTypeDataFn, selectPokemonFn, resetBattleFn],
  );

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
