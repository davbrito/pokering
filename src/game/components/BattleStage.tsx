import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { PokemonDetail } from "../../api/pokeapi";
import { cn } from "../../lib/utils";
import { getArtworkUrl } from "../api";
import { playPokemonCries, playPokemonCry } from "../audio";
import { BattleEngine } from "../battle-engine";
import { getStatsObject } from "../combat";
import { useChosenPokemon, useGameStore } from "../store";
import type { BattleDamageStep, BattleStatusStep, BattleStep } from "../types";
import { DamagePopup, type DamagePopupData } from "./DamagePopup";
import { usePokemonName } from "./PokemonName";
import { type Projectile, ProjectileFx } from "./ProjectileFx";
import { RenderStatusContent, RenderStepContent } from "./renderStepContent";

export function BattleStage() {
  const playbackSpeed = useGameStore((s) => s.battle.playbackSpeed);
  const currentStep = useGameStore((s) => s.battle.logs[s.battle.currentStepIdx] ?? null);
  const players = useGameStore((s) => s.players);
  const maxHealths = [players.player1.maxHealth, players.player2.maxHealth] as const;
  const currentHps = [players.player1.currentHp, players.player2.currentHp] as const;
  const isPaused = useGameStore((s) => s.battle.isPaused);
  const battleSteps = useGameStore((s) => s.battle.logs);
  const battlePhase = useGameStore((s) => s.battle.phase);
  const p1Level = useGameStore((s) => s.players.player1.level);
  const p2Level = useGameStore((s) => s.players.player2.level);
  const p1Moves = useGameStore((s) => s.players.player1.moves);
  const p2Moves = useGameStore((s) => s.players.player2.moves);
  const p1Pp = useGameStore((s) => s.players.player1.pp);
  const p2Pp = useGameStore((s) => s.players.player2.pp);
  const { chosen } = useChosenPokemon();
  const [p1Data, p2Data] = chosen;
  const p1Name = usePokemonName(p1Data, "Luchador 1");
  const p2Name = usePokemonName(p2Data, "Luchador 2");

  const [animClass0, setAnimClass0] = useState("");
  const [animClass1, setAnimClass1] = useState("");
  const [shakeScreen, setShakeScreen] = useState(false);
  const [damagePopups, setDamagePopups] = useState<DamagePopupData[]>([]);
  const [statusPopups, setStatusPopups] = useState<{ id: string; targetIdx: number; step: BattleStatusStep }[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [playingCryIdx, setPlayingCryIdx] = useState<number | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef0 = useRef<HTMLImageElement | null>(null);
  const imgRef1 = useRef<HTMLImageElement | null>(null);
  const engineRef = useRef<BattleEngine | null>(null);

  const startedRef = useRef(false);

  const finishBattle = () => {
    useGameStore.getState().setBattlePhase("result");
    setAnimClass0("");
    setAnimClass1("");
  };

  const applyImpact = (defIdx: number, step: BattleDamageStep) => {
    if (defIdx === 0) setAnimClass0("hit-shake");
    else setAnimClass1("hit-shake");

    if (step.isCrit || step.eff > 1.5) {
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 350);
    }

    const popId = crypto.randomUUID();
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
  };

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

    const pid = crypto.randomUUID();
    setProjectiles((prev) => [...prev, { id: pid, sx, sy, tx, ty, moveType }]);
    const animTime = 380 / useGameStore.getState().battle.playbackSpeed;
    setTimeout(() => {
      setProjectiles((prev) => prev.filter((p) => p.id !== pid));
      onComplete();
    }, animTime);
  }, []);

  const executeStepVisuals = (step: BattleStep) => {
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

      // Descontar PP en el store
      if (step.move.pp > 0) {
        const store = useGameStore.getState();
        const playerKey = atkIdx === 0 ? "player1" : "player2";
        const pp = [...store.players[playerKey].pp];
        const moveIdx = store.players[playerKey].moves.findIndex((m) => m.name === step.move.name);
        if (moveIdx !== -1 && pp[moveIdx] > 0) {
          pp[moveIdx]--;
          store.setPlayerPp(atkIdx, pp);
        }
      }

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
      const id = crypto.randomUUID();
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
  };

  const onExecuteStep = useEffectEvent(executeStepVisuals);
  const onFinish = useEffectEvent(finishBattle);

  // Initialize engine once
  useEffect(() => {
    const engine = new BattleEngine({ onExecuteStep, onFinish });
    engineRef.current = engine;
    return () => engine.stop();
  }, []);

  // Start playback when battle phase changes
  useEffect(() => {
    if (battlePhase === "battle" && battleSteps.length > 0 && !startedRef.current) {
      startedRef.current = true;
      setAnimClass0("");
      setAnimClass1("");
      setDamagePopups([]);
      setStatusPopups([]);
      setProjectiles([]);
      const timer = setTimeout(() => engineRef.current?.start(0), 400);
      return () => clearTimeout(timer);
    }
    if (battlePhase !== "battle") startedRef.current = false;
    return undefined;
  }, [battlePhase, battleSteps.length]);

  const togglePause = () => {
    const store = useGameStore.getState();
    store.setIsPaused(!store.battle.isPaused);
  };

  const toggleSpeed = () => {
    const store = useGameStore.getState();
    const b = useGameStore.getState().battle;
    store.setPlaybackSpeed(b.playbackSpeed === 4 ? 1 : ((b.playbackSpeed * 2) as 1 | 2 | 4));
  };
  const skipCinematics = () => {
    engineRef.current?.stop();
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

  // Construir datos de PP para los HUDs desde el estado del store
  const pp1 = p1Moves.map((m, i) => ({ name: m.name, pp: p1Pp[i] ?? 0, maxPp: m.pp }));
  const pp2 = p2Moves.map((m, i) => ({ name: m.name, pp: p2Pp[i] ?? 0, maxPp: m.pp }));

  return (
    <div className={cn("stage-container isolate", battlePhase === "battle" && "show")} id="stageContainer">
      <div
        className={cn("stage-viewport isolate", shakeScreen && "screen-shake-anim")}
        id="stageViewport"
        ref={viewportRef}
      >
        <div className="stage-huds">
          <PlayerHud name={p1Name} currentHp={currentHps[0]} maxHp={maxHealths[0]} meta={p1Meta} pp={pp1} />
          <PlayerHud name={p2Name} currentHp={currentHps[1]} maxHp={maxHealths[1]} meta={p2Meta} pp={pp2} />
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
        <div className="stage-dialog">
          <RenderStepContent step={currentStep} p1Name={p1Name} p2Name={p2Name} />
        </div>
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

function PlayerHud({
  name,
  currentHp,
  maxHp,
  meta,
  pp,
}: {
  name: string;
  currentHp: number;
  maxHp: number;
  meta: string;
  pp: { name: string; pp: number; maxPp: number }[];
}) {
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
      {pp.length > 0 && (
        <div className="hud-pp-wrap">
          {pp.map((m) => {
            const pctPp = m.maxPp > 0 ? Math.round((m.pp / m.maxPp) * 100) : 0;
            const ppColor = pctPp > 50 ? "var(--blue)" : pctPp > 20 ? "var(--gold)" : "var(--accent)";
            return (
              <div key={m.name} className="hud-pp-row">
                <span className="hud-pp-name">{m.name}</span>
                <div className="hud-pp-track">
                  <div className="hud-pp-fill" style={{ width: `${pctPp}%`, backgroundColor: ppColor }} />
                </div>
                <span className="hud-pp-num">
                  {m.pp}/{m.maxPp}
                </span>
              </div>
            );
          })}
        </div>
      )}
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
  statusPopups: { id: string; targetIdx: number; step: BattleStatusStep }[];
  playingCry: boolean;
}) {
  const anchorName = `--fighter-${index + 1}`;
  return (
    <div>
      <div className={cn("fighter-wrapper", index === 0 ? "p1" : "p2")} style={{ anchorName }}>
        <div className="fighter-platform" />
        {pokemon && (
          <img
            className={cn("fighter-sprite", animClass, playingCry && "cry-shake")}
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
            <RenderStatusContent step={pop.step} targetName={name} />
          </div>
        ))}
    </div>
  );
}
