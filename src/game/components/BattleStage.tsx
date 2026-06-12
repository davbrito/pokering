import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { getArtworkUrl } from "../api";
import { getStatsObject } from "../combat";
import {
  battlePhase,
  battleSteps,
  chosen,
  currentHps,
  currentStepIdx,
  isPaused,
  maxHealths,
  playbackSpeed,
  setBattlePhase,
  setCurrentHps,
  setCurrentStepIdx,
  setIsPaused,
  setPlaybackSpeed,
} from "../store";
import type { BattleStep } from "../types";

function getStepDuration(step: BattleStep, speed: number): number {
  let base = 1800;
  if (step.type === "start") base = 2200;
  if (step.type === "faint") base = 2000;
  if (step.type === "end") base = 2500;
  if (step.type === "action") {
    base = step.category === "special" ? 2000 : 1800;
  }
  return base / speed;
}

export function BattleStage() {
  const [dialogHtml, setDialogHtml] = createSignal(
    "Preparando la arena de combate...",
  );
  const [animClass0, setAnimClass0] = createSignal("");
  const [animClass1, setAnimClass1] = createSignal("");
  const [shakeScreen, setShakeScreen] = createSignal(false);
  const [damagePopups, setDamagePopups] = createSignal<
    Array<{
      id: number;
      idx: number;
      content: string;
      isCrit: boolean;
    }>
  >([]);
  const [projectiles, setProjectiles] = createSignal<
    Array<{
      id: number;
      x: number;
      y: number;
      tx: number;
      ty: number;
      bg: string;
      shadow: string;
    }>
  >([]);

  let viewportRef: HTMLDivElement | undefined;
  let imgRef0: HTMLImageElement | undefined;
  let imgRef1: HTMLImageElement | undefined;
  let playbackTimer: ReturnType<typeof setTimeout> | null = null;
  let popupCounter = 0;
  let projCounter = 0;

  const hpPct = (idx: number) => {
    const cur = currentHps();
    const max = maxHealths();
    return Math.max(0, Math.min(100, (cur[idx] / max[idx]) * 100));
  };

  const hpColor = (idx: number) => {
    const pct = hpPct(idx);
    if (pct >= 50) return "var(--green)";
    if (pct >= 20) return "var(--gold)";
    return "var(--accent)";
  };

  function playStep(idx: number) {
    if (isPaused()) return;
    const steps = battleSteps();
    if (idx >= steps.length) {
      finishBattle();
      return;
    }

    const step = steps[idx];
    setCurrentStepIdx(idx);
    executeStepVisuals(step);

    const duration = getStepDuration(step, playbackSpeed());
    playbackTimer = setTimeout(() => playStep(idx + 1), duration);
  }

  function executeStepVisuals(step: BattleStep) {
    setDialogHtml(step.text);

    if (step.type === "start") {
      const mh = maxHealths();
      setCurrentHps([...mh]);
    }

    if (step.type === "action") {
      const atkIdx = step.attackerIdx ?? 0;
      const defIdx = atkIdx === 0 ? 1 : 0;

      if (step.category === "physical") {
        // Lunge animation
        setAnimClass0("");
        setAnimClass1("");
        if (atkIdx === 0) setAnimClass0("lunge-right");
        else setAnimClass1("lunge-left");

        setTimeout(() => {
          applyImpact(defIdx, step);
        }, 200 / playbackSpeed());

        setTimeout(() => {
          if (atkIdx === 0) setAnimClass0("");
          else setAnimClass1("");
        }, 450 / playbackSpeed());
      } else {
        triggerProjectile(atkIdx, defIdx, step.moveType || "normal", () => {
          applyImpact(defIdx, step);
        });
      }
    }

    if (step.type === "faint" && step.faintedIdx !== undefined) {
      if (step.faintedIdx === 0) setAnimClass0("faint-slide");
      else setAnimClass1("faint-slide");
    }

    if (step.type === "end") {
      setAnimClass0("");
      setAnimClass1("");
    }
  }

  function applyImpact(defIdx: number, step: BattleStep) {
    // Shake the defender
    if (defIdx === 0) setAnimClass0("hit-shake");
    else setAnimClass1("hit-shake");

    // Screen shake for crit/super effective
    if (step.isCrit || (step.eff != null && step.eff > 1.5)) {
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 350);
    }

    const popId = ++popupCounter;
    let content = `-${step.damage ?? 0}`;
    if (step.isCrit) {
      content +=
        '<span class="popup-sub" style="color:var(--gold)">¡CRÍTICO!</span>';
    } else if (step.eff != null && step.eff > 1.5) {
      content +=
        '<span class="popup-sub" style="color:var(--green)">¡SÚPER EFICAZ!</span>';
    } else if (step.eff != null && step.eff < 0.6 && step.eff > 0) {
      content +=
        '<span class="popup-sub" style="color:var(--muted)">POCO EFICAZ</span>';
    } else if (step.eff === 0) {
      content = '<span style="font-size: 24px">INMUNE</span>';
    }

    setDamagePopups((prev) => [
      ...prev,
      { id: popId, idx: defIdx, content, isCrit: !!step.isCrit },
    ]);
    setTimeout(() => {
      setDamagePopups((prev) => prev.filter((p) => p.id !== popId));
    }, 900);

    // Update HP
    if (step.postHp) {
      setCurrentHps(step.postHp);
    }

    setTimeout(() => {
      if (defIdx === 0) setAnimClass0("");
      else setAnimClass1("");
    }, 400);
  }

  function triggerProjectile(
    atkIdx: number,
    defIdx: number,
    moveType: string,
    onComplete: () => void,
  ) {
    const atkImg = atkIdx === 0 ? imgRef0 : imgRef1;
    const defImg = defIdx === 0 ? imgRef0 : imgRef1;
    const viewport = viewportRef;

    if (!atkImg || !defImg || !viewport) {
      onComplete();
      return;
    }

    const rectAtk = atkImg.getBoundingClientRect();
    const rectDef = defImg.getBoundingClientRect();
    const rectViewport = viewport.getBoundingClientRect();

    const startX = rectAtk.left + rectAtk.width / 2 - rectViewport.left;
    const startY = rectAtk.top + rectAtk.height / 2 - rectViewport.top;
    const targetX = rectDef.left + rectDef.width / 2 - rectViewport.left;
    const targetY = rectDef.top + rectDef.height / 2 - rectViewport.top;

    let bg = "#ffffff";
    let shadow = "0 0 15px #ffffff";
    if (["fire"].includes(moveType)) {
      bg = "#ff4500";
      shadow = "0 0 20px #ff0000, 0 0 40px #ff4500";
    } else if (["water", "ice"].includes(moveType)) {
      bg = "#00bfff";
      shadow = "0 0 20px #1e90ff, 0 0 40px #00bfff";
    } else if (["electric"].includes(moveType)) {
      bg = "#ffd700";
      shadow = "0 0 20px #ffff00, 0 0 40px #ffd700";
    } else if (["grass", "bug"].includes(moveType)) {
      bg = "#32cd32";
      shadow = "0 0 20px #00ff00, 0 0 40px #32cd32";
    } else if (["ghost", "dark", "poison", "psychic"].includes(moveType)) {
      bg = "#8a2be2";
      shadow = "0 0 20px #9400d3, 0 0 40px #8a2be2";
    }

    const pid = ++projCounter;
    setProjectiles((prev) => [
      ...prev,
      { id: pid, x: startX, y: startY, tx: targetX, ty: targetY, bg, shadow },
    ]);

    const animTime = 380 / playbackSpeed();
    setTimeout(() => {
      setProjectiles((prev) => prev.filter((p) => p.id !== pid));
      onComplete();
    }, animTime);
  }

  function finishBattle() {
    setBattlePhase("result");
    setAnimClass0("");
    setAnimClass1("");
  }

  function togglePause() {
    if (isPaused()) {
      setIsPaused(false);
      playStep(currentStepIdx());
    } else {
      setIsPaused(true);
      if (playbackTimer) clearTimeout(playbackTimer);
    }
  }

  function toggleSpeed() {
    setPlaybackSpeed((s) => (s === 4 ? 1 : ((s * 2) as 1 | 2 | 4)));
  }

  function skipCinematics() {
    if (playbackTimer) clearTimeout(playbackTimer);
    setIsPaused(false);
    finishBattle();
  }

  onCleanup(() => {
    if (playbackTimer) clearTimeout(playbackTimer);
  });

  // Watch for battle phase changes and start playback when steps are ready
  createEffect(() => {
    const phase = battlePhase();
    if (phase === "battle") {
      const steps = battleSteps();
      if (steps.length > 0) {
        setDialogHtml("Preparando la arena de combate...");
        setAnimClass0("");
        setAnimClass1("");
        setDamagePopups([]);
        setProjectiles([]);
        const timer = setTimeout(() => playStep(0), 400);
        onCleanup(() => clearTimeout(timer));
      }
    }
  });

  const speedLabel = () => `${playbackSpeed()}x`;

  const p1Data = () => chosen()[0];
  const p2Data = () => chosen()[1];

  const p1Name = () => p1Data()?.name ?? "Luchador 1";
  const p2Name = () => p2Data()?.name ?? "Luchador 2";
  const p1Meta = () => {
    const d = p1Data();
    if (!d) return "#000 · BST 0";
    const t = Object.values(getStatsObject(d)).reduce((a, b) => a + b, 0);
    return `#${String(d.id).padStart(3, "0")} · BST ${t}`;
  };
  const p2Meta = () => {
    const d = p2Data();
    if (!d) return "#000 · BST 0";
    const t = Object.values(getStatsObject(d)).reduce((a, b) => a + b, 0);
    return `#${String(d.id).padStart(3, "0")} · BST ${t}`;
  };

  return (
    <Show when={battlePhase() === "battle" || battlePhase() === "result"}>
      <div
        class={`stage-container${battlePhase() === "battle" ? " show" : ""}`}
        id="stageContainer"
      >
        <div
          class={`stage-viewport${shakeScreen() ? " screen-shake-anim" : ""}`}
          id="stageViewport"
          ref={(el) => (viewportRef = el)}
        >
          {/* HUDS */}
          <div class="stage-huds">
            <div class="hud-box" id="hud-0">
              <div class="hud-name" id="hud-name-0">
                {p1Name()}
              </div>
              <div class="hud-meta" id="hud-meta-0">
                {p1Meta()}
              </div>
              <div class="hud-hp-wrap">
                <div
                  class="hud-hp-fill"
                  id="hp-bar-0"
                  style={{
                    width: `${hpPct(0)}%`,
                    "background-color": hpColor(0),
                  }}
                />
              </div>
              <div class="hud-hp-text" id="hp-txt-0">
                {currentHps()[0]} / {maxHealths()[0]} PS
              </div>
            </div>

            <div class="hud-box" id="hud-1">
              <div class="hud-name" id="hud-name-1">
                {p2Name()}
              </div>
              <div class="hud-meta" id="hud-meta-1">
                {p2Meta()}
              </div>
              <div class="hud-hp-wrap">
                <div
                  class="hud-hp-fill"
                  id="hp-bar-1"
                  style={{
                    width: `${hpPct(1)}%`,
                    "background-color": hpColor(1),
                  }}
                />
              </div>
              <div class="hud-hp-text" id="hp-txt-1">
                {currentHps()[1]} / {maxHealths()[1]} PS
              </div>
            </div>
          </div>

          {/* Fighters */}
          <div class="stage-grid" id="stageGrid">
            <div class={`fighter-wrapper p1`} id="fighter-wrapper-0">
              <div class="fighter-platform"></div>
              <Show when={p1Data()}>
                {(d) => (
                  <img
                    class={`fighter-sprite${animClass0() ? ` ${animClass0()}` : ""}`}
                    id="fighter-img-0"
                    src={getArtworkUrl(d())}
                    alt="Fighter 1"
                    ref={(el) => (imgRef0 = el)}
                  />
                )}
              </Show>
              {/* Damage popups */}
              <For each={damagePopups().filter((p) => p.idx === 0)}>
                {(pop) => (
                  <div
                    class={`damage-popup${pop.isCrit ? " crit" : ""}`}
                    innerHTML={pop.content}
                  />
                )}
              </For>
            </div>

            <div class={`fighter-wrapper p2`} id="fighter-wrapper-1">
              <div class="fighter-platform"></div>
              <Show when={p2Data()}>
                {(d) => (
                  <img
                    class={`fighter-sprite${animClass1() ? ` ${animClass1()}` : ""}`}
                    id="fighter-img-1"
                    src={getArtworkUrl(d())}
                    alt="Fighter 2"
                    ref={(el) => (imgRef1 = el)}
                  />
                )}
              </Show>
              <For each={damagePopups().filter((p) => p.idx === 1)}>
                {(pop) => (
                  <div
                    class={`damage-popup${pop.isCrit ? " crit" : ""}`}
                    innerHTML={pop.content}
                  />
                )}
              </For>
            </div>
          </div>

          {/* Projectiles */}
          <For each={projectiles()}>
            {(proj) => (
              <div
                class="fx-projectile"
                style={{
                  background: proj.bg,
                  "box-shadow": proj.shadow,
                  left: `${proj.tx}px`,
                  top: `${proj.ty}px`,
                  transition: `all ${380 / playbackSpeed()}ms cubic-bezier(0.25, 1, 0.5, 1)`,
                  transform: "translate(-50%, -50%) scale(1.6)",
                }}
              />
            )}
          </For>
        </div>

        {/* Footer controls */}
        <div class="stage-footer">
          <div class="stage-dialog" id="stageDialog" innerHTML={dialogHtml()} />
          <div class="stage-controls">
            <button
              type="button"
              class="ctrl-btn"
              id="btn-pause"
              onClick={togglePause}
            >
              {isPaused() ? "Reanudar" : "Pausa"}
            </button>
            <button
              type="button"
              class="ctrl-btn"
              id="btn-speed"
              onClick={toggleSpeed}
            >
              Velocidad {speedLabel()}
            </button>
            <button
              type="button"
              class="ctrl-btn"
              id="btn-skip"
              onClick={skipCinematics}
            >
              Saltar
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
