import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import { getArtworkUrl } from "../api";
import { getStatsObject } from "../combat";
import { useChosenPokemon, useGameStore } from "../store";
import type { BattleStep } from "../types";
import { renderStepContent } from "./renderStepContent";

function getStepDuration(step: BattleStep, speed: number): number {
  let base = 1800;
  if (step.type === "start") base = 2200;
  if (step.type === "miss") base = 1500;
  if (step.type === "faint") base = 2000;
  if (step.type === "end") base = 2500;
  if (step.type === "action") base = step.category === "special" ? 2000 : 1800;
  return base / speed;
}

interface DamagePopupData {
  id: number;
  idx: number;
  damage?: number;
  subtitle?: string;
  subtitleColor?: string;
  isCrit: boolean;
  isImmune: boolean;
}

function DamagePopup({ pop }: { pop: DamagePopupData }) {
  return (
    <div className={`damage-popup${pop.isCrit ? "crit" : ""}`}>
      {pop.isImmune ? (
        <span style={{ fontSize: 24 }}>{m.battle_immune()}</span>
      ) : (
        <>
          <span className="popup-dmg">-{pop.damage}</span>
          {pop.subtitle && (
            <span className="popup-sub" style={{ color: pop.subtitleColor }}>
              {pop.subtitle}
            </span>
          )}
        </>
      )}
    </div>
  );
}

interface Projectile {
  id: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  bg: string;
  shadow: string;
}

export function BattleStage() {
  const playbackSpeed = useGameStore((s) => s.playbackSpeed);
  const maxHealths = useGameStore((s) => s.maxHealths);
  const currentHps = useGameStore((s) => s.currentHps);
  const isPaused = useGameStore((s) => s.isPaused);
  const battleSteps = useGameStore((s) => s.battleSteps);
  const battlePhase = useGameStore((s) => s.battlePhase);
  const { chosen } = useChosenPokemon();

  const [currentStep, setCurrentStep] = useState<BattleStep | null>(null);
  const [animClass0, setAnimClass0] = useState("");
  const [animClass1, setAnimClass1] = useState("");
  const [shakeScreen, setShakeScreen] = useState(false);
  const [damagePopups, setDamagePopups] = useState<DamagePopupData[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef0 = useRef<HTMLImageElement>(null);
  const imgRef1 = useRef<HTMLImageElement>(null);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupCounter = useRef(0);
  const projCounter = useRef(0);
  const startedRef = useRef(false);

  const hpPct = (idx: number) => {
    return Math.max(0, Math.min(100, (currentHps[idx] / maxHealths[idx]) * 100));
  };

  const hpColor = (idx: number) => {
    const pct = hpPct(idx);
    if (pct >= 50) return "var(--green)";
    if (pct >= 20) return "var(--gold)";
    return "var(--accent)";
  };

  const finishBattle = useCallback(() => {
    useGameStore.getState().setBattlePhase("result");
    setAnimClass0("");
    setAnimClass1("");
  }, []);

  const applyImpact = useCallback((defIdx: number, step: BattleStep) => {
    if (defIdx === 0) setAnimClass0("hit-shake");
    else setAnimClass1("hit-shake");

    if (step.isCrit || (step.eff != null && step.eff > 1.5)) {
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 350);
    }

    const popId = ++popupCounter.current;
    const popDamage = step.eff === 0 ? undefined : (step.damage ?? 0);
    let popSubtitle: string | undefined;
    let popSubColor: string | undefined;
    const isImmune = step.eff === 0;

    if (step.isCrit) {
      popSubtitle = "¡CRÍTICO!";
      popSubColor = "var(--gold)";
    } else if (step.eff != null && step.eff > 1.5) {
      popSubtitle = "¡SÚPER EFICAZ!";
      popSubColor = "var(--green)";
    } else if (step.eff != null && step.eff < 0.6 && step.eff > 0) {
      popSubtitle = "POCO EFICAZ";
      popSubColor = "var(--muted)";
    }

    setDamagePopups((prev) => [
      ...prev,
      {
        id: popId,
        idx: defIdx,
        damage: popDamage,
        subtitle: popSubtitle,
        subtitleColor: popSubColor,
        isCrit: !!step.isCrit,
        isImmune,
      },
    ]);
    setTimeout(() => {
      setDamagePopups((prev) => prev.filter((p) => p.id !== popId));
    }, 900);

    if (step.postHp) useGameStore.getState().setCurrentHps(step.postHp);

    setTimeout(() => {
      if (defIdx === 0) setAnimClass0("");
      else setAnimClass1("");
    }, 400);
  }, []);

  const triggerProjectile = useCallback((atkIdx: number, defIdx: number, moveType: string, onComplete: () => void) => {
    const atkImg = atkIdx === 0 ? imgRef0.current : imgRef1.current;
    const defImg = defIdx === 0 ? imgRef0.current : imgRef1.current;
    const viewport = viewportRef.current;
    if (!atkImg || !defImg || !viewport) {
      onComplete();
      return;
    }

    const ra = atkImg.getBoundingClientRect();
    const rd = defImg.getBoundingClientRect();
    const rv = viewport.getBoundingClientRect();

    const sx = ra.left + ra.width / 2 - rv.left;
    const sy = ra.top + ra.height / 2 - rv.top;
    const tx = rd.left + rd.width / 2 - rv.left;
    const ty = rd.top + rd.height / 2 - rv.top;

    let bg = "#ffffff",
      shadow = "0 0 15px #ffffff";
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

    const pid = ++projCounter.current;
    setProjectiles((prev) => [...prev, { id: pid, sx, sy, tx, ty, bg, shadow }]);
    const animTime = 380 / useGameStore.getState().playbackSpeed;
    setTimeout(() => {
      setProjectiles((prev) => prev.filter((p) => p.id !== pid));
      onComplete();
    }, animTime);
  }, []);

  const executeStepVisuals = useCallback(
    (step: BattleStep) => {
      setCurrentStep(step);
      if (step.type === "start") useGameStore.getState().setCurrentHps([...useGameStore.getState().maxHealths]);
      if (step.type === "action") {
        const atkIdx = step.attackerIdx ?? 0;
        const defIdx = atkIdx === 0 ? 1 : 0;
        if (step.category === "physical") {
          setAnimClass0("");
          setAnimClass1("");
          if (atkIdx === 0) setAnimClass0("lunge-right");
          else setAnimClass1("lunge-left");
          const spd = useGameStore.getState().playbackSpeed;
          setTimeout(() => applyImpact(defIdx, step), 200 / spd);
          setTimeout(() => {
            if (atkIdx === 0) setAnimClass0("");
            else setAnimClass1("");
          }, 450 / spd);
        } else {
          triggerProjectile(atkIdx, defIdx, step.moveType || "normal", () => applyImpact(defIdx, step));
        }
      }
      if (step.type === "miss") {
        // El movimiento falló: sin animación de daño, solo mostrar el texto
      }
      if (step.type === "faint" && step.faintedIdx !== undefined) {
        if (step.faintedIdx === 0) setAnimClass0("faint-slide");
        else setAnimClass1("faint-slide");
      }
      if (step.type === "end") {
        setAnimClass0("");
        setAnimClass1("");
      }
    },
    [applyImpact, triggerProjectile],
  );

  const playStep = useCallback(
    (idx: number) => {
      const store = useGameStore.getState();
      if (store.isPaused) return;
      const steps = store.battleSteps;
      if (idx >= steps.length) {
        finishBattle();
        return;
      }
      const step = steps[idx];
      store.setCurrentStepIdx(idx);
      executeStepVisuals(step);
      const duration = getStepDuration(step, store.playbackSpeed);
      playbackTimer.current = setTimeout(() => playStep(idx + 1), duration);
    },
    [executeStepVisuals, finishBattle],
  );

  // Start playback when battle phase changes
  useEffect(() => {
    if (battlePhase === "battle" && battleSteps.length > 0 && !startedRef.current) {
      startedRef.current = true;
      setCurrentStep(null);
      setAnimClass0("");
      setAnimClass1("");
      setDamagePopups([]);
      setProjectiles([]);
      const timer = setTimeout(() => playStep(0), 400);
      return () => clearTimeout(timer);
    }
    if (battlePhase !== "battle") startedRef.current = false;
    return undefined;
  }, [battlePhase, battleSteps.length, playStep]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (playbackTimer.current) clearTimeout(playbackTimer.current);
    };
  }, []);

  const togglePause = () => {
    const store = useGameStore.getState();
    if (store.isPaused) {
      store.setIsPaused(false);
      playStep(store.currentStepIdx);
    } else {
      store.setIsPaused(true);
      if (playbackTimer.current) clearTimeout(playbackTimer.current);
    }
  };

  const toggleSpeed = () => {
    const store = useGameStore.getState();
    store.setPlaybackSpeed(store.playbackSpeed === 4 ? 1 : ((store.playbackSpeed * 2) as 1 | 2 | 4));
  };
  const skipCinematics = () => {
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    useGameStore.getState().setIsPaused(false);
    finishBattle();
  };

  if (battlePhase !== "battle" && battlePhase !== "result") return null;

  const p1Data = chosen[0];
  const p2Data = chosen[1];
  const p1Name = p1Data?.name ?? "Luchador 1";
  const p2Name = p2Data?.name ?? "Luchador 2";
  const p1Meta = p1Data
    ? `#${String(p1Data.id).padStart(3, "0")} · BST ${Object.values(getStatsObject(p1Data)).reduce((a, b) => a + b, 0)}`
    : "#000 · BST 0";
  const p2Meta = p2Data
    ? `#${String(p2Data.id).padStart(3, "0")} · BST ${Object.values(getStatsObject(p2Data)).reduce((a, b) => a + b, 0)}`
    : "#000 · BST 0";

  return (
    <div className={`stage-container ${battlePhase === "battle" ? "show" : ""}`} id="stageContainer">
      <div className={`stage-viewport ${shakeScreen ? "screen-shake-anim" : ""}`} id="stageViewport" ref={viewportRef}>
        <div className="stage-huds">
          <div className="hud-box" id="hud-0">
            <div className="hud-name">{p1Name}</div>
            <div className="hud-meta">{p1Meta}</div>
            <div className="hud-hp-wrap">
              <div className="hud-hp-fill" style={{ width: `${hpPct(0)}%`, backgroundColor: hpColor(0) }} />
            </div>
            <div className="hud-hp-text">
              {currentHps[0]} / {maxHealths[0]} PS
            </div>
          </div>
          <div className="hud-box" id="hud-1">
            <div className="hud-name">{p2Name}</div>
            <div className="hud-meta">{p2Meta}</div>
            <div className="hud-hp-wrap">
              <div className="hud-hp-fill" style={{ width: `${hpPct(1)}%`, backgroundColor: hpColor(1) }} />
            </div>
            <div className="hud-hp-text">
              {currentHps[1]} / {maxHealths[1]} PS
            </div>
          </div>
        </div>

        <div className="stage-grid" id="stageGrid">
          <div className="fighter-wrapper p1" id="fighter-wrapper-0">
            <div className="fighter-platform" />
            {p1Data && (
              <img
                className={`fighter-sprite ${animClass0 ? ` ${animClass0}` : ""}`}
                src={getArtworkUrl(p1Data)}
                alt="Fighter 1"
                ref={imgRef0}
              />
            )}
            {damagePopups
              .filter((p) => p.idx === 0)
              .map((pop) => (
                <DamagePopup key={pop.id} pop={pop} />
              ))}
          </div>
          <div className="fighter-wrapper p2" id="fighter-wrapper-1">
            <div className="fighter-platform" />
            {p2Data && (
              <img
                className={`fighter-sprite${animClass1 ? ` ${animClass1}` : ""}`}
                src={getArtworkUrl(p2Data)}
                alt="Fighter 2"
                ref={imgRef1}
              />
            )}
            {damagePopups
              .filter((p) => p.idx === 1)
              .map((pop) => (
                <DamagePopup key={pop.id} pop={pop} />
              ))}
          </div>
        </div>

        {projectiles.map((proj) => (
          <motion.div
            key={proj.id}
            className="fx-projectile"
            style={{
              background: proj.bg,
              boxShadow: proj.shadow,
            }}
            initial={{
              left: proj.sx,
              top: proj.sy,
              x: "-50%",
              y: "-50%",
              scale: 1.6,
            }}
            animate={{
              left: proj.tx,
              top: proj.ty,
              x: "-50%",
              y: "-50%",
              scale: 1.6,
            }}
            transition={{
              duration: 0.38 / playbackSpeed,
              ease: [0.25, 1, 0.5, 1],
            }}
          />
        ))}
      </div>

      <div className="stage-footer">
        <div className="stage-dialog">{renderStepContent(currentStep, p1Name, p2Name)}</div>
        <div className="stage-controls">
          <button type="button" className="ctrl-btn" onClick={togglePause}>
            {isPaused ? "Reanudar" : "Pausa"}
          </button>
          <button type="button" className="ctrl-btn" onClick={toggleSpeed}>
            Velocidad {playbackSpeed}x
          </button>
          <button type="button" className="ctrl-btn" onClick={skipCinematics}>
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}
