import { useCallback, useEffect, useRef, useState } from "react";
import type { PokemonDetail } from "../../api/pokeapi";
import { cn } from "../../lib/utils";
import { getArtworkUrl } from "../api";
import { playPokemonCries, playPokemonCry } from "../audio";
import { getStatsObject } from "../combat";
import { useChosenPokemon, useGameStore } from "../store";
import type { BattleDamageStep, BattleStatusStep, BattleStep } from "../types";
import { DamagePopup, type DamagePopupData } from "./DamagePopup";
import { usePokemonName } from "./PokemonName";
import { type Projectile, ProjectileFx } from "./ProjectileFx";
import { renderStatusContent, renderStepContent } from "./renderStepContent";

function getStepDuration(step: BattleStep, speed: number): number {
  let base = 1800;
  if (step.type === "start") base = 2200;
  if (step.type === "miss") base = 1500;
  if (step.type === "faint") base = 2000;
  if (step.type === "end") base = 2500;
  if (step.type === "status") base = 1700;
  if (step.type === "passive") base = 1500;
  if (step.type === "use-move") base = step.move.damageClass === "special" ? 2000 : 1800;
  if (step.type === "damage") base = 600;
  return base / speed;
}

export function BattleStage() {
  const playbackSpeed = useGameStore((s) => s.battle.playbackSpeed);
  const players = useGameStore((s) => s.players);
  const maxHealths = [players.player1.maxHealth, players.player2.maxHealth] as const;
  const currentHps = [players.player1.currentHp, players.player2.currentHp] as const;
  const isPaused = useGameStore((s) => s.battle.isPaused);
  const battleSteps = useGameStore((s) => s.battle.logs);
  const battlePhase = useGameStore((s) => s.battle.phase);
  const p1Level = useGameStore((s) => s.players.player1.level);
  const p2Level = useGameStore((s) => s.players.player2.level);
  const { chosen } = useChosenPokemon();
  const [p1Data, p2Data] = chosen;
  const p1Name = usePokemonName(p1Data, "Luchador 1");
  const p2Name = usePokemonName(p2Data, "Luchador 2");

  const [currentStep, setCurrentStep] = useState<BattleStep | null>(null);
  const [animClass0, setAnimClass0] = useState("");
  const [animClass1, setAnimClass1] = useState("");
  const [shakeScreen, setShakeScreen] = useState(false);
  const [damagePopups, setDamagePopups] = useState<DamagePopupData[]>([]);
  const [statusPopups, setStatusPopups] = useState<{ id: number; targetIdx: number; step: BattleStatusStep }[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [playingCryIdx, setPlayingCryIdx] = useState<number | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef0 = useRef<HTMLImageElement | null>(null);
  const imgRef1 = useRef<HTMLImageElement | null>(null);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupCounter = useRef(0);
  const projCounter = useRef(0);
  const startedRef = useRef(false);

  const finishBattle = useCallback(() => {
    useGameStore.getState().setBattlePhase("result");
    setAnimClass0("");
    setAnimClass1("");
  }, []);

  const applyImpact = useCallback((defIdx: number, step: BattleDamageStep) => {
    if (defIdx === 0) setAnimClass0("hit-shake");
    else setAnimClass1("hit-shake");

    if (step.isCrit || step.eff > 1.5) {
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 350);
    }

    const popId = ++popupCounter.current;
    setDamagePopups((prev) => [...prev, { id: popId, defIdx, step }]);
    setTimeout(() => {
      setDamagePopups((prev) => prev.filter((p) => p.id !== popId));
    }, 900);

    const store = useGameStore.getState();
    const hps: [number, number] = [store.players.player1.currentHp, store.players.player2.currentHp];
    hps[defIdx] = step.currentHp;
    store.setCurrentHps(hps);

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

    const pid = ++projCounter.current;
    setProjectiles((prev) => [...prev, { id: pid, sx, sy, tx, ty, moveType }]);
    const animTime = 380 / useGameStore.getState().battle.playbackSpeed;
    setTimeout(() => {
      setProjectiles((prev) => prev.filter((p) => p.id !== pid));
      onComplete();
    }, animTime);
  }, []);

  const executeStepVisuals = useCallback(
    (step: BattleStep) => {
      setCurrentStep(step);
      if (step.type === "start") {
        const p = useGameStore.getState().players;
        useGameStore.getState().setCurrentHps([p.player1.maxHealth, p.player2.maxHealth]);
        playPokemonCries(p1Data, p2Data, 1200, {
          onP1Play: {
            onPlay: () => setPlayingCryIdx(0),
            onEnd: () => setPlayingCryIdx(null),
          },
          onP2Play: {
            onPlay: () => setPlayingCryIdx(1),
            onEnd: () => setPlayingCryIdx(null),
          },
        });
      }
      if (step.type === "use-move") {
        const atkIdx = step.attackerIdx;
        const defIdx = atkIdx === 0 ? 1 : 0;
        if (step.move.damageClass === "physical") {
          setAnimClass0("");
          setAnimClass1("");
          if (atkIdx === 0) setAnimClass0("lunge-right");
          else setAnimClass1("lunge-left");
          const spd = useGameStore.getState().battle.playbackSpeed;
          setTimeout(() => {
            if (atkIdx === 0) setAnimClass0("");
            else setAnimClass1("");
          }, 450 / spd);
        } else {
          triggerProjectile(atkIdx, defIdx, step.move.type, () => {});
        }
      }
      if (step.type === "damage") {
        const defIdx = step.targetIdx;
        applyImpact(defIdx, step);
      }
      if (step.type === "miss") {
        // El movimiento falló: sin animación de daño, solo mostrar el texto
      }
      if (step.type === "status") {
        const id = ++popupCounter.current;
        setStatusPopups((prev) => [...prev, { id, targetIdx: step.targetIdx, step }]);
        setTimeout(() => {
          setStatusPopups((prev) => prev.filter((p) => p.id !== id));
        }, 1200);
      }
      if (step.type === "faint") {
        if (step.faintedIdx === 0) setAnimClass0("faint-slide");
        else setAnimClass1("faint-slide");
        const faintedPoke = step.faintedIdx === 0 ? p1Data : p2Data;
        if (faintedPoke) {
          playPokemonCry(faintedPoke, {
            onPlay: () => setPlayingCryIdx(step.faintedIdx),
            onEnd: () => setPlayingCryIdx(null),
          });
        }
      }
      if (step.type === "end") {
        setAnimClass0("");
        setAnimClass1("");
      }
    },
    [applyImpact, triggerProjectile, p1Data, p2Data],
  );

  const playStep = useCallback(
    (idx: number) => {
      const store = useGameStore.getState();
      if (store.battle.isPaused) return;
      const steps = store.battle.logs;
      if (idx >= steps.length) {
        finishBattle();
        return;
      }
      const step = steps[idx];
      store.setCurrentStepIdx(idx);
      executeStepVisuals(step);
      const duration = getStepDuration(step, store.battle.playbackSpeed);
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
      setStatusPopups([]);
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
    if (store.battle.isPaused) {
      store.setIsPaused(false);
      playStep(store.battle.currentStepIdx);
    } else {
      store.setIsPaused(true);
      if (playbackTimer.current) clearTimeout(playbackTimer.current);
    }
  };

  const toggleSpeed = () => {
    const store = useGameStore.getState();
    const b = useGameStore.getState().battle;
    store.setPlaybackSpeed(b.playbackSpeed === 4 ? 1 : ((b.playbackSpeed * 2) as 1 | 2 | 4));
  };
  const skipCinematics = () => {
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    useGameStore.getState().setIsPaused(false);
    finishBattle();
  };

  if (battlePhase !== "battle" && battlePhase !== "result") return null;

  const p1Meta = p1Data
    ? `#${String(p1Data.id).padStart(3, "0")} · Nv.${p1Level} · BST ${Object.values(getStatsObject(p1Data)).reduce((a, b) => a + b, 0)}`
    : "#000 · Nv.? · BST 0";
  const p2Meta = p2Data
    ? `#${String(p2Data.id).padStart(3, "0")} · Nv.${p2Level} · BST ${Object.values(getStatsObject(p2Data)).reduce((a, b) => a + b, 0)}`
    : "#000 · Nv.? · BST 0";

  return (
    <div className={cn("stage-container isolate", battlePhase === "battle" && "show")} id="stageContainer">
      <div
        className={cn("stage-viewport isolate", shakeScreen && "screen-shake-anim")}
        id="stageViewport"
        ref={viewportRef}
      >
        <div className="stage-huds">
          <PlayerHud name={p1Name} currentHp={currentHps[0]} maxHp={maxHealths[0]} meta={p1Meta} />
          <PlayerHud name={p2Name} currentHp={currentHps[1]} maxHp={maxHealths[1]} meta={p2Meta} />
        </div>

        <div className="stage-grid" id="stageGrid">
          <Figter
            index={0}
            name={p1Name}
            imgRef={imgRef0}
            animClass={animClass0}
            pokemon={p1Data}
            damagePopups={damagePopups}
            statusPopups={statusPopups}
            playingCry={playingCryIdx === 0}
          />
          <Figter
            index={1}
            name={p2Name}
            imgRef={imgRef1}
            animClass={animClass1}
            pokemon={p2Data}
            damagePopups={damagePopups}
            statusPopups={statusPopups}
            playingCry={playingCryIdx === 1}
          />
        </div>

        {projectiles.map((proj) => (
          <ProjectileFx key={proj.id} proj={proj} playbackSpeed={playbackSpeed} />
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

function PlayerHud({ name, currentHp, maxHp, meta }: { name: string; currentHp: number; maxHp: number; meta: string }) {
  const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

  const hpColor = () => {
    if (pct >= 50) return "var(--green)";
    if (pct >= 20) return "var(--gold)";
    return "var(--accent)";
  };
  return (
    <div className="hud-box">
      <div className="hud-name">{name}</div>
      <div className="hud-meta">{meta}</div>
      <div className="hud-hp-wrap">
        <div className="hud-hp-fill" style={{ width: `${pct}%`, backgroundColor: hpColor() }} />
      </div>
      <div className="hud-hp-text">
        {currentHp} / {maxHp} PS
      </div>
    </div>
  );
}

function Figter({
  index,
  name,
  imgRef,
  animClass,
  pokemon,
  damagePopups,
  statusPopups,
  playingCry,
}: {
  index: number;
  name: string;
  imgRef: React.RefObject<HTMLImageElement | null>;
  animClass: string;
  pokemon: PokemonDetail | null;
  damagePopups: DamagePopupData[];
  statusPopups: { id: number; targetIdx: number; step: BattleStatusStep }[];
  playingCry: boolean;
}) {
  const anchorName = `--fighter-${index + 1}`;
  return (
    <div>
      <div className={cn("fighter-wrapper", index === 0 ? "p1" : "p2")} style={{ anchorName }}>
        <div className="fighter-platform" />
        {pokemon && (
          <img
            className={cn("fighter-sprite", animClass)}
            src={getArtworkUrl(pokemon)}
            alt={`Fighter ${index + 1}`}
            ref={imgRef}
          />
        )}
        {pokemon && playingCry && (
          <div className="cry-indicator">
            <span className="cry-wave" />
            <span className="cry-wave" />
            <span className="cry-wave" />
          </div>
        )}
      </div>
      {damagePopups
        .filter((p) => p.defIdx === index)
        .map((pop) => (
          <DamagePopup key={pop.id} pop={pop} positionAnchor={anchorName} />
        ))}
      {statusPopups
        .filter((p) => p.targetIdx === index)
        .map((pop) => (
          <div
            key={pop.id}
            className="status-popup absolute z-10"
            style={{
              positionAnchor: anchorName,
              top: "anchor(bottom)",
              justifySelf: "anchor-center",
            }}
          >
            {renderStatusContent(pop.step, name)}
          </div>
        ))}
    </div>
  );
}
