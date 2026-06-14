export function randomProbability(prob: number): boolean {
  return Math.random() < prob;
}

export function coinFlip(): boolean {
  return randomProbability(0.5);
}
