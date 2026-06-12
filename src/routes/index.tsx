import { createFileRoute } from "@tanstack/solid-router";
import { onMount, Show } from "solid-js";
import {
  calcHpStat,
  generateBattleSteps,
  getStatsObject,
} from "../game/combat";
import { BattleResult } from "../game/components/BattleResult";
import { BattleStage } from "../game/components/BattleStage";
import { PokemonModal } from "../game/components/PokemonModal";
import { PokemonSlot } from "../game/components/PokemonSlot";
import {
  battlePhase,
  bothReady,
  chosen,
  loadAllPokemon,
  setBattlePhase,
  setBattleSteps,
  setCurrentHps,
  setCurrentStepIdx,
  setIsPaused,
  setMaxHealths,
} from "../game/store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  onMount(() => {
    loadAllPokemon();
  });

  const startBattle = () => {
    const poke1 = chosen()[0];
    const poke2 = chosen()[1];
    if (!poke1 || !poke2) return;

    const s1 = getStatsObject(poke1);
    const s2 = getStatsObject(poke2);
    const mh1 = calcHpStat(s1.hp);
    const mh2 = calcHpStat(s2.hp);

    setMaxHealths([mh1, mh2]);
    setCurrentHps([mh1, mh2]);

    const steps = generateBattleSteps(poke1, poke2, s1, s2, mh1, mh2);
    setBattleSteps(steps);
    setCurrentStepIdx(0);
    setIsPaused(false);

    setBattlePhase("battle");

    // Scroll to stage
    setTimeout(() => {
      const stage = document.getElementById("stageContainer");
      stage?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // Reset handler
  const goBackToSelection = () => {
    setBattlePhase("selection");
  };

  return (
    <>
      <div class="wrap">
        <header>
          <p class="eyebrow">— Simulador de batalla Pokémon —</p>
          <h1>
            Poké<em>Arena</em>
          </h1>
          <p class="tagline">
            Elige tus combatientes, analiza sus estadísticas y descubre quién
            dominaría el campo de batalla
          </p>
        </header>

        {/* ARENA SELECTION CONTAINER */}
        <Show
          when={battlePhase() === "selection"}
          fallback={
            <div class="battle-section" id="battleSection">
              <button
                class="battle-btn"
                type="button"
                onClick={goBackToSelection}
              >
                ⚔ Nueva batalla
              </button>
            </div>
          }
        >
          <div class="arena-grid" id="arenaGrid">
            <PokemonSlot index={0} label="Luchador 1" />
            <div class="vs-col">
              <div class="vs-line"></div>
              <div class="vs-txt">VS</div>
              <div class="vs-line"></div>
            </div>
            <PokemonSlot index={1} label="Luchador 2" />
          </div>

          <div class="battle-section" id="battleSection">
            <button
              class="battle-btn"
              id="battleBtn"
              disabled={!bothReady()}
              type="button"
              onClick={startBattle}
            >
              ⚔ Comenzar batalla
            </button>
          </div>
        </Show>

        {/* STAGE DE COMBATE VISUAL */}
        <BattleStage />

        {/* RESULTADOS */}
        <BattleResult />
      </div>

      <footer>
        <div class="wrap">
          Datos por <span>PokéAPI</span> · Motor de Combate por{" "}
          <span>PokéArena JS</span>· No afiliado con Nintendo o Game Freak
        </div>
      </footer>

      {/* MODAL */}
      <PokemonModal />
    </>
  );
}
