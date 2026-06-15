import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Settings Store ──────────────────────────────────────────────────────────
// Persisted settings: audio preferences and Pokémon language.

interface AudioSettings {
  enabled: boolean;
  volume: number; // 0.0 — 1.0
}

interface SettingsState {
  /** Idioma para nombres de Pokémon (código ISO, ej. "es", "ja", "fr") */
  pokemonLanguage: string;
  audio: AudioSettings;
}

interface SettingsActions {
  setPokemonLanguage: (lang: string) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setAudioVolume: (volume: number) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // ── State ──
      pokemonLanguage: "es",
      audio: {
        enabled: true,
        volume: 0.5,
      },

      // ── Actions ──
      setPokemonLanguage: (lang) => set({ pokemonLanguage: lang }),

      setAudioEnabled: (enabled) => set((s) => ({ audio: { ...s.audio, enabled } })),

      setAudioVolume: (volume) => set((s) => ({ audio: { ...s.audio, volume } })),
    }),
    {
      name: "pokering-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
