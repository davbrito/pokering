import { clamp } from "es-toolkit/math";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { PokemonDetail } from "../../api/pokeapi";
import { cn } from "../../lib/utils";
import { getArtworkUrl } from "../api";
import { playPokemonCries, playPokemonCry } from "../audio";
import { getBst } from "../combat";
import { GameActorContext, useBattleView, useGamePhase } from "../game-actor";
import { nextSpeed } from "../machine";
import { useChosenPokemon } from "../store";
import type { BattleDamageStep, BattleStatusStep, BattleStep } from "../types";
import { DamagePopup, type DamagePopupData } from "./DamagePopup";
import { usePokemonName } from "./PokemonName";
import { type Projectile, ProjectileFx } from "./ProjectileFx";
import { RenderStatusContent, RenderStepContent } from "./renderStepContent";

export function BattleStage() {
  const actorRef = GameActorContext.useActorRef();
  const battlePhase = useGamePhase();
  const playbackSpeed = GameActorContext.useSelector((s) => s.context.speed);
  const isPaused = GameActorContext.useSelector((s) => s.hasTag("paused"));
  const currentStep = GameActorContext.useSelector((s) => s.context.prepared?.steps[s.context.stepIdx] ?? null);
  const fighters = GameActorContext.useSelector((s) => s.context.match?.fighters ?? null);
  const setup = GameActorContext.useSelector((s) => s.context.prepared?.setup ?? null);
  const view = useBattleView();
  const maxHealths = setup?.maxHp ?? ([100, 100] as const);
  const currentHps = view?.hp ?? maxHealths;
  const p1Level = fighters?.[0].level ?? 50;
  const p2Level = fighters?.[1].level ?? 50;
  const p1Moves = setup?.moves[0] ?? [];
  const p2Moves = setup?.moves[1] ?? [];
  const p1Pp = view?.pp[0] ?? [];
  const p2Pp = view?.pp[1] ?? [];
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

  // Temporizadores de efectos visuales: se cancelan en `clear` para que no sobrevivan a la batalla.
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);
  const speedRef = useRef(playbackSpeed);
  speedRef.current = playbackSpeed;
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef0 = useRef<HTMLImageElement | null>(null);
  const imgRef1 = useRef<HTMLImageElement | null>(null);

  const applyImpact = (defIdx: number, step: BattleDamageStep) => {
    if (defIdx === 0) setAnimClass0("hit-shake");
    else setAnimClass1("hit-shake");

    if (step.isCrit || step.eff > 1.5) {
      setShakeScreen(true);
      later(() => setShakeScreen(false), 350);
    }

    const popId = crypto.randomUUID();
    setDamagePopups((prev) => [...prev, { id: popId, defIdx, step }]);
    later(() => {
      setDamagePopups((prev) => prev.filter((p) => p.id !== popId));
    }, 900);

    later(() => {
      if (defIdx === 0) setAnimClass0("");
      else setAnimClass1("");
    }, 400);
  };

  const triggerProjectile = useCallback(
    (atkIdx: number, defIdx: number, moveType: string, onComplete: () => void) => {
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
      const animTime = 380 / speedRef.current;
      later(() => {
        setProjectiles((prev) => prev.filter((p) => p.id !== pid));
        onComplete();
      }, animTime);
    },
    [later],
  );

  const executeStepVisuals = (step: BattleStep) => {
    if (step.type === "start") {
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
        const spd = speedRef.current;
        later(() => {
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
      later(() => {
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
  const onClear = useEffectEvent(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current.clear();
    setShakeScreen(false);
    setAnimClass0("");
    setAnimClass1("");
    setDamagePopups([]);
    setStatusPopups([]);
    setProjectiles([]);
  });

  // Efectos visuales/sonoros: la máquina emite cada paso al entrar en escena.
  useEffect(() => {
    const stepSub = actorRef.on("step.played", ({ step }) => onExecuteStep(step));
    const clearSub = actorRef.on("battle.ended", () => onClear());
    return () => {
      stepSub.unsubscribe();
      clearSub.unsubscribe();
    };
  }, [actorRef]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };
  }, []);

  const canTogglePause = GameActorContext.useSelector(
    (s) => s.can({ type: "playback.pause" }) || s.can({ type: "playback.resume" }),
  );
  const canToggleSpeed = GameActorContext.useSelector((s) => s.can({ type: "playback.setSpeed", speed: 1 }));
  const togglePause = () => actorRef.send({ type: isPaused ? "playback.resume" : "playback.pause" });
  const toggleSpeed = () => actorRef.send({ type: "playback.setSpeed", speed: nextSpeed(playbackSpeed) });
  const skipCinematics = () => actorRef.send({ type: "playback.skip" });

  if (battlePhase !== "battle" && battlePhase !== "result") return null;

  const p1Meta = p1Data
    ? `#${String(p1Data.id).padStart(3, "0")} · Nv.${p1Level} · BST ${getBst(p1Data)}`
    : "#000 · Nv.? · BST 0";
  const p2Meta = p2Data
    ? `#${String(p2Data.id).padStart(3, "0")} · Nv.${p2Level} · BST ${getBst(p2Data)}`
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
          <button type="button" className="ctrl-btn" onClick={togglePause} disabled={!canTogglePause}>
            {isPaused ? "Reanudar" : "Pausa"}
          </button>
          <button type="button" className="ctrl-btn" onClick={toggleSpeed} disabled={!canToggleSpeed}>
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
  const pct = clamp((currentHp / maxHp) * 100, 0, 100);

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
