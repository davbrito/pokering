import { useGameStore } from "./store";
import type { BattleStep } from "./types";

export interface EngineCallbacks {
  onExecuteStep: (step: BattleStep) => void;
  onFinish: () => void;
}

export class BattleEngine {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulatedTime = 0;
  private currentDuration = 0;
  private stepIdx = 0;

  constructor(private callbacks: EngineCallbacks) {}

  public start(startIndex: number) {
    this.stepIdx = startIndex;
    this.accumulatedTime = 0;
    this.lastTime = 0;

    const store = useGameStore.getState();
    const steps = store.battle.logs;

    if (this.stepIdx >= steps.length) {
      this.callbacks.onFinish();
      return;
    }

    const step = steps[this.stepIdx];
    store.setCurrentStepIdx(this.stepIdx);
    this.callbacks.onExecuteStep(step);
    this.currentDuration = this.getBaseDuration(step);

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  public stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (timestamp: number) => {
    if (this.lastTime === 0) this.lastTime = timestamp;

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    const store = useGameStore.getState();

    if (!store.battle.isPaused) {
      this.accumulatedTime += deltaTime * store.battle.playbackSpeed;

      if (this.accumulatedTime >= this.currentDuration) {
        this.accumulatedTime = 0;
        this.stepIdx += 1;

        const steps = store.battle.logs;
        if (this.stepIdx >= steps.length) {
          this.callbacks.onFinish();
          this.stop();
          return;
        }

        const nextStep = steps[this.stepIdx];
        store.setCurrentStepIdx(this.stepIdx);
        this.callbacks.onExecuteStep(nextStep);
        this.currentDuration = this.getBaseDuration(nextStep);
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private getBaseDuration(step: BattleStep): number {
    let base = 1800;
    if (step.type === "start") base = 2200;
    if (step.type === "miss") base = 1500;
    if (step.type === "faint") base = 2000;
    if (step.type === "end") base = 2500;
    if (step.type === "status") base = 1700;
    if (step.type === "passive") base = 1500;
    if (step.type === "use-move") base = step.move.damageClass === "special" ? 2000 : 1800;
    if (step.type === "damage") base = 600;
    return base;
  }
}
