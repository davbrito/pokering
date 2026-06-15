import type { PokemonDetail } from "../api/pokeapi";
import { useSettingsStore } from "./settings-store";

export interface CryCallbacks {
  /** Se dispara cuando el buffer empieza a reproducirse realmente. */
  onPlay?: () => void;
  /** Se dispara cuando el audio termina o falla. */
  onEnd?: () => void;
}

// ─── Web Audio API AudioManager ─────────────────────────────────────────────
// Precarga los gritos en AudioBuffers en memoria para latencia cero.
// Soporta múltiples sonidos superpuestos y volumen por GainNode.

class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<number, AudioBuffer>();
  /** IDs cuyo precarga está en curso (evita duplicados) */
  private loading = new Set<number>();

  /** Inicializa o reanuda el AudioContext (requiere gesto del usuario). */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Precarga el grito de un Pokémon en un AudioBuffer.
   * Es seguro llamarlo múltiples veces — la segunda es no-op.
   */
  async preload(pokemon: PokemonDetail): Promise<void> {
    const id = pokemon.id;
    if (this.buffers.has(id) || this.loading.has(id)) return;

    const url = pokemon.cries.legacy;
    if (!url) return;

    this.loading.add(id);
    try {
      const ctx = this.ensureContext();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(id, audioBuffer);
    } catch {
      // URL inválida o formato no soportado — se ignora silenciosamente
    } finally {
      this.loading.delete(id);
    }
  }

  /** Precarga múltiples Pokémon en paralelo. */
  async preloadAll(...pokemon: (PokemonDetail | null)[]): Promise<void> {
    await Promise.all(pokemon.filter((p): p is PokemonDetail => p !== null).map((p) => this.preload(p)));
  }

  /**
   * Reproduce el grito precargado de un Pokémon con latencia cero.
   * Si no está precargado, lo descarga y reproduce al vuelo.
   * Permite múltiples reproducciones superpuestas del mismo Pokémon.
   */
  play(pokemon: PokemonDetail, callbacks?: CryCallbacks): void {
    const { enabled, volume } = useSettingsStore.getState().audio;
    if (!enabled) return;

    const id = pokemon.id;
    const buffer = this.buffers.get(id);

    if (buffer) {
      this.playFromBuffer(buffer, volume, callbacks);
    } else {
      // No precargado: descarga al vuelo y reproduce cuando esté listo
      this.preload(pokemon).then(() => {
        const b = this.buffers.get(id);
        if (b) this.playFromBuffer(b, volume, callbacks);
      });
    }
  }

  /**
   * Reproduce el grito del primero e inmediatamente programa el segundo
   * con el retraso indicado. Cada uno puede tener sus propios callbacks.
   */
  playCries(
    p1: PokemonDetail | null,
    p2: PokemonDetail | null,
    delay = 1200,
    callbacks?: { onP1Play?: CryCallbacks; onP2Play?: CryCallbacks },
  ): void {
    if (p1) {
      this.play(p1, callbacks?.onP1Play);
    }
    if (p2) {
      setTimeout(() => this.play(p2, callbacks?.onP2Play), delay);
    }
  }

  /** Crea un source node, lo conecta con gain y lo reproduce. */
  private playFromBuffer(buffer: AudioBuffer, volume: number, callbacks?: CryCallbacks): void {
    try {
      const ctx = this.ensureContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = volume * 0.8;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.onended = () => {
        callbacks?.onEnd?.();
      };

      source.start(0);
      callbacks?.onPlay?.();
    } catch {
      callbacks?.onEnd?.();
    }
  }
}

/** Singleton global del gestor de audio. */
export const audioManager = new AudioManager();

// ─── Wrappers de compatibilidad ──────────────────────────────────────────────
// Mantienen la misma API pública para no romper los consumidores existentes.

export function playPokemonCry(pokemon: PokemonDetail, callbacks?: CryCallbacks): void {
  audioManager.play(pokemon, callbacks);
}

export function playPokemonCries(
  p1: PokemonDetail | null,
  p2: PokemonDetail | null,
  delay = 1200,
  callbacks?: { onP1Play?: CryCallbacks; onP2Play?: CryCallbacks },
): void {
  audioManager.playCries(p1, p2, delay, callbacks);
}
