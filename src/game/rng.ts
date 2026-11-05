export interface Rng {
  /** Float en [0, 1). */
  next(): number;
  /** Entero en [a, b] (ambos incluidos). */
  int(a: number, b: number): number;
  /** Float en [a, b). */
  float(a: number, b: number): number;
  /** true con probabilidad p. */
  chance(p: number): boolean;
  /** Elemento aleatorio de un array (undefined si está vacío). */
  pick<T>(arr: readonly T[]): T | undefined;
}

/** PRNG determinista (mulberry32). Misma semilla ⇒ misma secuencia. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    float: (a, b) => a + next() * (b - a),
    chance: (p) => next() < p,
    pick: (arr) => (arr.length === 0 ? undefined : arr[Math.floor(next() * arr.length)]),
  };
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
