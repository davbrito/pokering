import { createMemo, createSignal } from "solid-js";
import { fetchAllPokemon, fetchPokemonByName, fetchTypeData } from "./api";
import type { BattleStep, PokemonDetail, PokemonListItem } from "./types";

// -- Lista de Pokémon --
export const [allPokemon, setAllPokemon] = createSignal<PokemonListItem[]>([]);

export async function loadAllPokemon() {
  const data = await fetchAllPokemon();
  setAllPokemon(data);
}

// -- Datos por tipo --
const typeCache: Record<string, PokemonListItem[]> = {};

export async function loadTypeData(type: string): Promise<PokemonListItem[]> {
  if (typeCache[type]) return typeCache[type];
  const data = await fetchTypeData(type);
  typeCache[type] = data;
  return data;
}

// -- Modal state --
export const [modalOpen, setModalOpen] = createSignal(false);
export const [activeSlot, setActiveSlot] = createSignal(0);
export const [searchQuery, setSearchQuery] = createSignal("");
export const [activeTab, setActiveTab] = createSignal("all");
export const [typePokemon, setTypePokemon] = createSignal<PokemonListItem[]>(
  [],
);

// -- Preview cache --
const previewCache: Record<number, PokemonDetail> = {};

export function getPreviewCache(id: number): PokemonDetail | undefined {
  return previewCache[id];
}

export function setPreviewCache(id: number, data: PokemonDetail) {
  previewCache[id] = data;
}

// -- Chosen Pokémon --
export const [chosen, setChosen] = createSignal<
  [PokemonDetail | null, PokemonDetail | null]
>([null, null]);

export const [chosenLoading, setChosenLoading] = createSignal<
  [boolean, boolean]
>([false, false]);

export const bothReady = createMemo(
  () => chosen()[0] !== null && chosen()[1] !== null,
);

export async function selectPokemon(slot: number, name: string) {
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
}

// -- Battle state --
export const [battlePhase, setBattlePhase] = createSignal<
  "selection" | "battle" | "result"
>("selection");

export const [battleSteps, setBattleSteps] = createSignal<BattleStep[]>([]);
export const [currentStepIdx, setCurrentStepIdx] = createSignal(0);
export const [playbackSpeed, setPlaybackSpeed] = createSignal(1);
export const [isPaused, setIsPaused] = createSignal(false);
export const [maxHealths, setMaxHealths] = createSignal<[number, number]>([
  100, 100,
]);
export const [currentHps, setCurrentHps] = createSignal<[number, number]>([
  100, 100,
]);

export function resetBattle() {
  setBattlePhase("selection");
  setBattleSteps([]);
  setCurrentStepIdx(0);
  setPlaybackSpeed(1);
  setIsPaused(false);
  setMaxHealths([100, 100]);
  setCurrentHps([100, 100]);
}
