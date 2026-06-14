import type { PokemonDetail } from "../api/pokeapi";
import { useGameStore } from "./store";

export interface CryCallbacks {
  /** Se dispara cuando el audio empieza a reproducirse realmente. */
  onPlay?: () => void;
  /** Se dispara cuando el audio termina o falla. */
  onEnd?: () => void;
}

/**
 * Reproduce el grito (cry) de un Pokémon usando la URL de la PokéAPI.
 * Lee la configuración de audio (enabled/volume) del store global.
 * Crea un elemento <audio> temporal, lo reproduce y lo limpia al terminar.
 *
 * Acepta callbacks opcionales para sincronizar estado visual con el audio.
 */
export function playPokemonCry(pokemon: PokemonDetail, callbacks?: CryCallbacks): void {
  const { enabled, volume } = useGameStore.getState().audio;
  if (!enabled) return;

  const url = pokemon.cries.latest;
  if (!url) return;

  const audio = new Audio(url);
  audio.volume = volume * 0.8;

  const cleanup = () => {
    callbacks?.onEnd?.();
    audio.remove();
  };

  audio.addEventListener("play", () => {
    callbacks?.onPlay?.();
  });

  audio.addEventListener("ended", cleanup);
  audio.addEventListener("error", cleanup);

  audio.play().catch(() => {
    // Autoplay bloqueado — notificamos como fin para limpiar el estado visual
    cleanup();
  });
}

/**
 * Reproduce el grito de un Pokémon y opcionalmente el del segundo
 * con un retraso entre ellos. Cada uno puede tener sus propios callbacks.
 */
export function playPokemonCries(
  p1: PokemonDetail | null,
  p2: PokemonDetail | null,
  delay = 1200,
  callbacks?: { onP1Play?: CryCallbacks; onP2Play?: CryCallbacks },
): void {
  if (p1) {
    playPokemonCry(p1, callbacks?.onP1Play);
  }
  if (p2) {
    setTimeout(() => playPokemonCry(p2, callbacks?.onP2Play), delay);
  }
}
