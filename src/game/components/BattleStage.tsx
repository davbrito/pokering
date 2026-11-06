import { clamp } from "es-toolkit/math";
import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PokemonDetail } from "../../api/pokeapi";
import { cn } from "../../lib/utils";
import { getArtworkUrl } from "../api";
import { playPokemonCries, playPokemonCry } from "../audio";
import { getBst } from "../combat";
import {
  GameActorContext,
  useBattleView,
  useGamePhase,
  useGameSend,
  useMatch,
  usePlayback,
  usePlaybackSpeed,
  usePrepared,
  useStageFx,
  useStepIdx,
} from "../game-actor";
import { nextSpeed } from "../playback-machine";
import type { DamagePopupData, ProjectileData, StatusPopupData } from "../stage-fx-machine";
import { useChosenPokemon } from "../store";
import type { BattleStep } from "../types";
import { DamagePopup } from "./DamagePopup";
import { usePokemonName } from "./PokemonName";
import { ProjectileFx } from "./ProjectileFx";
import { RenderStatusContent, RenderStepContent } from "./renderStepContent";

export function BattleStage() {
  const phase = useGamePhase();
  return phase === "battle" || phase === "result" ? <BattleStageContent phase={phase} /> : null;
}

function BattleStageContent({ phase: battlePhase }: { phase: "battle" | "result" }) {
  const actorRef = GameActorContext.useActorRef();
  const send = useGameSend();
  const playbackSpeed = usePlaybackSpeed();
  const isPaused = usePlayback((snapshot) => snapshot.hasTag("paused"), false);
  const { fighters } = useMatch();
  const { setup, steps } = usePrepared();
  const view = useBattleView();
  const currentStep = steps[useStepIdx()] ?? null;
  const maxHealths = setup.maxHp;
  const currentHps = view.hp;
  const p1Level = fighters[0].level;
  const p2Level = fighters[1].level;
  const [p1Moves, p2Moves] = setup.moves;
  const [p1Pp, p2Pp] = view.pp;
  const { chosen } = useChosenPokemon();
  const [p1Data, p2Data] = chosen;
  const p1Name = usePokemonName(p1Data, "Luchador 1");
  const p2Name = usePokemonName(p2Data, "Luchador 2");

  const fx = useStageFx();
  const [playingCryIdx, setPlayingCryIdx] = useState<number | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef0 = useRef<HTMLImageElement | null>(null);
  const imgRef1 = useRef<HTMLImageElement | null>(null);
  const imgRefs = useMemo(() => [imgRef0, imgRef1] as const, []);

  // Animaciones, popups y proyectiles viven en el actor `fx` (con sus propios temporizadores);
  // aquí solo queda el audio, que necesita los datos de los Pokémon.
  const playAudio = (step: BattleStep) => {
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
    if (step.type === "faint") {
      const faintedPoke = step.faintedIdx === 0 ? p1Data : p2Data;
      if (faintedPoke) {
        playPokemonCry(faintedPoke, {
          onPlay: () => setPlayingCryIdx(step.faintedIdx),
          onEnd: () => setPlayingCryIdx(null),
        });
      }
    }
  };
  const onStepPlayed = useEffectEvent(playAudio);

  useEffect(() => {
    const sub = actorRef.on("step.played", ({ step }) => onStepPlayed(step));
    return () => sub.unsubscribe();
  }, [actorRef]);

  const canTogglePause = usePlayback(
    (snapshot) => snapshot.can({ type: "playback.pause" }) || snapshot.can({ type: "playback.resume" }),
    false,
  );
  const canToggleSpeed = usePlayback((snapshot) => snapshot.can({ type: "playback.setSpeed", speed: 1 }), false);
  const togglePause = () => send({ type: isPaused ? "playback.resume" : "playback.pause" });
  const toggleSpeed = () => send({ type: "playback.setSpeed", speed: nextSpeed(playbackSpeed) });
  const skipCinematics = () => send({ type: "playback.skip" });

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
        className={cn("stage-viewport isolate", fx.shake && "screen-shake-anim")}
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
            animClass={fx.anim[0]}
            pokemon={p1Data}
            damagePopups={fx.damagePopups}
            statusPopups={fx.statusPopups}
            playingCry={playingCryIdx === 0}
          />
          <Figter
            index={1}
            name={p2Name}
            imgRef={imgRef1}
            animClass={fx.anim[1]}
            pokemon={p2Data}
            damagePopups={fx.damagePopups}
            statusPopups={fx.statusPopups}
            playingCry={playingCryIdx === 1}
          />
        </div>

        {fx.projectiles.map((proj) => (
          <MeasuredProjectile
            key={proj.id}
            proj={proj}
            playbackSpeed={playbackSpeed}
            viewportRef={viewportRef}
            imgRefs={imgRefs}
          />
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
  damagePopups: readonly DamagePopupData[];
  statusPopups: readonly StatusPopupData[];
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

/**
 * La geometría (posiciones DOM) es asunto de la vista: se mide al montar el proyectil,
 * que el actor `fx` monta y desmonta con su temporizador.
 */
function MeasuredProjectile({
  proj,
  playbackSpeed,
  viewportRef,
  imgRefs,
}: {
  proj: ProjectileData;
  playbackSpeed: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  imgRefs: readonly [RefObject<HTMLImageElement | null>, RefObject<HTMLImageElement | null>];
}) {
  const [geometry, setGeometry] = useState<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  // Se mide en un efecto de layout (nunca durante el render), antes de pintar.
  useLayoutEffect(() => {
    const atkImg = imgRefs[proj.atkIdx]?.current;
    const defImg = imgRefs[proj.defIdx]?.current;
    const viewport = viewportRef.current;
    if (!atkImg || !defImg || !viewport) return;
    const ra = atkImg.getBoundingClientRect();
    const rd = defImg.getBoundingClientRect();
    const rv = viewport.getBoundingClientRect();
    setGeometry(
      (prev) =>
        prev ?? {
          sx: ra.left + ra.width / 2 - rv.left,
          sy: ra.top + ra.height / 2 - rv.top,
          tx: rd.left + rd.width / 2 - rv.left,
          ty: rd.top + rd.height / 2 - rv.top,
        },
    );
  }, [proj.atkIdx, proj.defIdx, imgRefs, viewportRef]);
  if (!geometry) return null;
  return <ProjectileFx proj={{ id: proj.id, moveType: proj.moveType, ...geometry }} playbackSpeed={playbackSpeed} />;
}
