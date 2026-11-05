import { createContext } from "unctx";
import { createRng, type Rng } from "./rng";

export interface GameContext {
  seed: number;
  rng: Rng;
}

// OJO: no usar el prefijo `use*` (Biome lo trata como hook de React).
// unctx pierde el contexto tras un `await` en el navegador: ejecutar solo código síncrono dentro de `runWithGameContext`.
const gameCtx = createContext<GameContext>();

/** Lanza error si no hay contexto activo. */
export const getGameContext = gameCtx.use;
/** `undefined` si no hay contexto activo. */
export const tryGetGameContext = gameCtx.tryUse;
export const runWithGameContext = gameCtx.call;

export function createGameContext(seed: number): GameContext {
  return { seed, rng: createRng(seed) };
}

export function runWithSeed<T>(seed: number, fn: () => T): T {
  return runWithGameContext(createGameContext(seed), fn);
}
