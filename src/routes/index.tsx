import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { calcHpStat, fetchPokemonMoves, generateBattleSteps, getStatsObject } from "../game/combat";
import { BattleResult } from "../game/components/BattleResult";
import { BattleStage } from "../game/components/BattleStage";
import { GameLoading } from "../game/components/GameLoading";
import { PokemonModal } from "../game/components/PokemonModal";
import { PokemonSlot } from "../game/components/PokemonSlot";
import { useBothReady, useChosenPokemon, useGameStore } from "../game/store";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
  pendingComponent: GameLoading,
});

function Home() {
  const battlePhase = useGameStore((s) => s.battlePhase);
  const isLoadingMoves = useGameStore((s) => s.isLoadingMoves);
  const bothReady = useBothReady();
  const { chosen } = useChosenPokemon();

  const { queryClient } = Route.useRouteContext();

  const startBattle = useCallback(async () => {
    const poke1 = chosen[0];
    const poke2 = chosen[1];
    if (!poke1 || !poke2) return;

    useGameStore.getState().setIsLoadingMoves(true);

    const [p1Moves, p2Moves] = await Promise.all([
      fetchPokemonMoves(queryClient, poke1),
      fetchPokemonMoves(queryClient, poke2),
    ]);

    const s1 = getStatsObject(poke1);
    const s2 = getStatsObject(poke2);
    const mh1 = calcHpStat(s1.hp);
    const mh2 = calcHpStat(s2.hp);

    const {
      setMaxHealths,
      setCurrentHps,
      setBattleSteps,
      setCurrentStepIdx,
      setIsPaused,
      setBattlePhase,
      setIsLoadingMoves,
    } = useGameStore.getState();
    setMaxHealths([mh1, mh2]);
    setCurrentHps([mh1, mh2]);

    const steps = generateBattleSteps(poke1, poke2, s1, s2, mh1, mh2, p1Moves, p2Moves);
    setBattleSteps(steps);
    setCurrentStepIdx(0);
    setIsPaused(false);
    setIsLoadingMoves(false);
    setBattlePhase("battle");

    setTimeout(() => {
      const stage = document.getElementById("stageContainer");
      stage?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [chosen]);

  const goBackToSelection = useCallback(() => {
    useGameStore.getState().setBattlePhase("selection");
  }, []);

  return (
    <>
      <div className="wrap">
        <header>
          <p className="eyebrow">{"\u2014 Simulador de batalla Pokémon \u2014"}</p>
          <h1>
            Poke
            <em>Ring</em>
          </h1>
          <p className="tagline">
            Elige tus combatientes, analiza sus estad{"\u00ed"}sticas y descubre qui{"\u00e9"}n dominar{"\u00ed"}a el
            campo de batalla
          </p>
        </header>

        {battlePhase === "selection" ? (
          <>
            <div className="arena-grid" id="arenaGrid">
              <PokemonSlot index={0} label="Luchador 1" />
              <div className="vs-col">
                <div className="vs-line" />
                <div className="vs-txt">VS</div>
                <div className="vs-line" />
              </div>
              <PokemonSlot index={1} label="Luchador 2" />
            </div>
            <div className="battle-section" id="battleSection">
              {isLoadingMoves ? (
                <div className="battle-loading">
                  <div className="spinner" />
                  <span className="battle-loading-msg">Analizando movimientos…</span>
                </div>
              ) : (
                <button className="battle-btn" id="battleBtn" disabled={!bothReady} type="button" onClick={startBattle}>
                  {"\u2694"} Comenzar batalla
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="battle-section" id="battleSection">
            <button className="battle-btn" type="button" onClick={goBackToSelection}>
              {"\u2694"} Nueva batalla
            </button>
          </div>
        )}

        <BattleStage />
        <BattleResult />
      </div>

      <footer>
        <div className="wrap">
          Datos por <span>Pok{"\u00e9"}API</span> {"\u00b7"} Motor de Combate por <span>Pok{"\u00e9"}Arena JS</span>
          {"\u00b7"} No afiliado con Nintendo o Game Freak
        </div>
      </footer>

      <PokemonModal />
    </>
  );
}
