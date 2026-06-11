import { createFileRoute } from "@tanstack/solid-router";
import gameScript from "../game/main.ts?url";

export const Route = createFileRoute("/")({
  component: Home,
  scripts() {
    return [{ src: gameScript }];
  },
});

function Home() {
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
        <div class="arena-grid" id="arenaGrid">
          <div class="slot" id="slot0">
            <div class="slot-lbl">Luchador 1</div>
            <button
              type="button"
              class="pick-btn"
              onClick={(event) => openModal(0)}
            >
              <span class="pb-icon">⊕</span>
              Seleccionar Pokémon
            </button>
            <div class="poke-card" id="card0"></div>
          </div>
          <div class="vs-col">
            <div class="vs-line"></div>
            <div class="vs-txt">VS</div>
            <div class="vs-line"></div>
          </div>
          <div class="slot" id="slot1">
            <div class="slot-lbl">Luchador 2</div>
            <button
              type="button"
              class="pick-btn"
              onClick={(event) => openModal(1)}
            >
              <span class="pb-icon">⊕</span>
              Seleccionar Pokémon
            </button>
            <div class="poke-card" id="card1"></div>
          </div>
        </div>

        <div class="battle-section" id="battleSection">
          <button
            class="battle-btn"
            id="battleBtn"
            disabled
            type="button"
            onClick={(event) => initiateBattleSequence()}
          >
            ⚔ Comenzar batalla
          </button>
        </div>

        {/* STAGE DE COMBATE VISUAL */}
        <div class="stage-container" id="stageContainer">
          <div class="stage-viewport" id="stageViewport">
            {/* HUDS */}
            <div class="stage-huds">
              <div class="hud-box" id="hud-0">
                <div class="hud-name" id="hud-name-0">
                  Luchador 1
                </div>
                <div class="hud-meta" id="hud-meta-0">
                  #000 · BST 0
                </div>
                <div class="hud-hp-wrap">
                  <div class="hud-hp-fill" id="hp-bar-0"></div>
                </div>
                <div class="hud-hp-text" id="hp-txt-0">
                  100 / 100 PS
                </div>
              </div>

              <div class="hud-box" id="hud-1">
                <div class="hud-name" id="hud-name-1">
                  Luchador 2
                </div>
                <div class="hud-meta" id="hud-meta-1">
                  #000 · BST 0
                </div>
                <div class="hud-hp-wrap">
                  <div class="hud-hp-fill" id="hp-bar-1"></div>
                </div>
                <div class="hud-hp-text" id="hp-txt-1">
                  100 / 100 PS
                </div>
              </div>
            </div>

            {/* COMBATIENTES */}
            <div class="stage-grid" id="stageGrid">
              <div class="fighter-wrapper p1" id="fighter-wrapper-0">
                <div class="fighter-platform"></div>
                <img
                  class="fighter-sprite"
                  id="fighter-img-0"
                  src=""
                  alt="Fighter 1"
                />
              </div>

              <div class="fighter-wrapper p2" id="fighter-wrapper-1">
                <div class="fighter-platform"></div>
                <img
                  class="fighter-sprite"
                  id="fighter-img-1"
                  src=""
                  alt="Fighter 2"
                />
              </div>
            </div>
          </div>

          {/* PIE DEL ESTADIO CONTROLES */}
          <div class="stage-footer">
            <div class="stage-dialog" id="stageDialog">
              Preparando la arena de combate...
            </div>
            <div class="stage-controls">
              <button
                type="button"
                class="ctrl-btn"
                id="btn-pause"
                onClick={(event) => togglePlayback()}
              >
                Pausa
              </button>
              <button
                type="button"
                class="ctrl-btn"
                id="btn-speed"
                onClick={(event) => toggleSpeed()}
              >
                Velocidad 1x
              </button>
              <button
                type="button"
                class="ctrl-btn"
                id="btn-skip"
                onClick={(event) => skipCinematics()}
              >
                Saltar
              </button>
            </div>
          </div>
        </div>

        {/* RESULTADOS */}
        <div id="result-wrap">
          <div id="result-inner"></div>
        </div>
      </div>

      <footer>
        <div class="wrap">
          Datos por <span>PokéAPI</span> · Motor de Combate por
          <span>PokéArena JS</span>· No afiliado con Nintendo o Game Freak
        </div>
      </footer>

      {/* MODAL */}
      <div
        class="modal-overlay"
        id="overlay"
        onClick={(event) => handleOverlayClick(event)}
      >
        <div class="modal">
          <div class="modal-head">
            <input
              class="modal-search"
              id="modal-search"
              type="text"
              placeholder="Buscar por nombre o número..."
              onInput={filterGrid}
            />
            <button type="button" class="modal-close" onClick={closeModal}>
              ✕
            </button>
          </div>
          <div class="tabs-bar" id="tabs-bar"></div>
          <div class="modal-body">
            <div class="poke-grid-wrap">
              <div class="poke-grid" id="poke-grid"></div>
            </div>
            <div class="preview-panel" id="preview-panel">
              <div class="preview-empty">
                <div class="pe-icon">👆</div>
                <div>Pasa el cursor sobre un Pokémon para verlo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
