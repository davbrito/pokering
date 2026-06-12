import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { calcHpStat, fetchPokemonMoves, generateBattleSteps, getStatsObject } from "../game/combat";
import { BattleResult } from "../game/components/BattleResult";
import { BattleStage } from "../game/components/BattleStage";
import { GameLoading } from "../game/components/GameLoading";
import { PokemonModal } from "../game/components/PokemonModal";
import { PokemonSlot } from "../game/components/PokemonSlot";
import { useBothReady, useGame, useGameActions } from "../game/store";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
  pendingComponent: GameLoading,
});

function Home() {
  const state = useGame();
  const actions = useGameActions();
  const bothReady = useBothReady();

  const { queryClient } = Route.useRouteContext();

  const startBattle = useCallback(async () => {
    const poke1 = state.chosen[0];
    const poke2 = state.chosen[1];
    if (!poke1 || !poke2) return;

    // Obtener movimientos reales desde la API (cacheados por TanStack Query)
    const [p1Moves, p2Moves] = await Promise.all([
      fetchPokemonMoves(queryClient, poke1),
      fetchPokemonMoves(queryClient, poke2),
    ]);

    const s1 = getStatsObject(poke1);
    const s2 = getStatsObject(poke2);
    const mh1 = calcHpStat(s1.hp);
    const mh2 = calcHpStat(s2.hp);

    actions.setMaxHealths([mh1, mh2]);
    actions.setCurrentHps([mh1, mh2]);

    const steps = generateBattleSteps(poke1, poke2, s1, s2, mh1, mh2, p1Moves, p2Moves);
    actions.setBattleSteps(steps);
    actions.setCurrentStepIdx(0);
    actions.setIsPaused(false);
    actions.setBattlePhase("battle");

    setTimeout(() => {
      const stage = document.getElementById("stageContainer");
      stage?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [state.chosen, actions]);

  const goBackToSelection = useCallback(() => {
    actions.setBattlePhase("selection");
  }, [actions]);

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

        {state.battlePhase === "selection" ? (
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
              <button className="battle-btn" id="battleBtn" disabled={!bothReady} type="button" onClick={startBattle}>
                {"\u2694"} Comenzar batalla
              </button>
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
