import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { clamp, randomInt } from "es-toolkit/math";
import { Settings, Shuffle, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import { getLocale, setLocale } from "#/i18n/paraglide/runtime.js";
import { BattleResult } from "../game/components/BattleResult";
import { BattleStage } from "../game/components/BattleStage";
import { PokemonModal } from "../game/components/PokemonModal";
import { PokemonSlot } from "../game/components/PokemonSlot";
import { GameActorContext, GameProvider, useGamePhase } from "../game/game-actor";
import type { Fighter } from "../game/prepare-battle";
import { useSettingsStore } from "../game/settings-store";
import { useGameStore, useSelectedFighters } from "../game/store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { queryClient } = Route.useRouteContext();
  return (
    <GameProvider queryClient={queryClient}>
      <HomeContent />
    </GameProvider>
  );
}

function HomeContent() {
  const actorRef = GameActorContext.useActorRef();
  const phase = useGamePhase();
  const isLoadingMoves = phase === "loading";
  const selected = useSelectedFighters();
  // La máquina decide si START es válido (solo en `selection`) y hay dos luchadores elegidos.
  const canStart = GameActorContext.useSelector(
    (s) => selected !== null && s.can({ type: "START", fighters: selected }),
  );

  useEffect(() => {
    if (phase === "battle") {
      document.getElementById("stageContainer")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [phase]);

  const startWith = (fighters: readonly [Fighter, Fighter]) => {
    // START solo se acepta en `selection`: un doble clic no puede lanzar dos batallas.
    actorRef.send({ type: "START", fighters });
  };

  const handleStartBattle = () => {
    if (selected) startWith(selected);
  };

  const randomBattle = () => {
    const store = useGameStore.getState();
    const baseLevel = randomInt(20, 80);
    const level1 = clamp(baseLevel + randomInt(-10, 10), 1, 100);
    const level2 = clamp(baseLevel + randomInt(-10, 10), 1, 100);
    const id1 = randomInt(1, 151);
    let id2 = randomInt(1, 151);
    while (id2 === id1) id2 = randomInt(1, 151);

    store.setLevel(0, level1);
    store.setLevel(1, level2);
    store.selectPokemon(0, id1);
    store.selectPokemon(1, id2);

    // Sin setTimeout: los luchadores viajan en el evento, la máquina hace el fetch.
    if (phase !== "selection") actorRef.send({ type: "BACK" });
    startWith([
      { id: id1, level: level1 },
      { id: id2, level: level2 },
    ]);
  };

  const goBackToSelection = () => actorRef.send({ type: "BACK" });
  const retry = () => actorRef.send({ type: "REMATCH" });

  return (
    <>
      <div className="wrap isolate">
        <Header />

        {phase === "selection" || phase === "loading" ? (
          <>
            <div className="arena-grid" id="arenaGrid">
              <PokemonSlot index={0} label={m.home_fighter_1()} />
              <div className="vs-col">
                <div className="vs-line" />
                <div className="vs-txt">VS</div>
                <div className="vs-line" />
              </div>
              <PokemonSlot index={1} label={m.home_fighter_2()} />
            </div>
            <div className="battle-section" id="battleSection">
              {isLoadingMoves ? (
                <div className="battle-loading">
                  <div className="spinner" />
                  <span className="battle-loading-msg">{m.home_analyzing_moves()}</span>
                </div>
              ) : (
                <div className="battle-btns">
                  <button
                    className="battle-btn"
                    id="battleBtn"
                    disabled={!canStart}
                    type="button"
                    onClick={handleStartBattle}
                  >
                    {m.home_start_battle()}
                  </button>
                  <button
                    className="battle-btn random aspect-square size-12 shrink-0 justify-center self-center"
                    type="button"
                    onClick={randomBattle}
                    title="Random battle"
                  >
                    <Shuffle size={20} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : phase === "error" ? (
          <div className="battle-section flex items-center justify-center gap-3" role="alert">
            <span>{m.home_error_title()}</span>
            <button className="battle-btn" type="button" onClick={retry}>
              {m.home_error_retry()}
            </button>
            <button className="battle-btn" type="button" onClick={goBackToSelection}>
              {m.home_error_back()}
            </button>
          </div>
        ) : (
          <div className="battle-section flex items-center justify-center gap-3">
            <button className="battle-btn" type="button" onClick={goBackToSelection}>
              {m.home_new_battle()}
            </button>
            <button
              className="battle-btn random aspect-square size-12 shrink-0 justify-center self-center"
              type="button"
              onClick={randomBattle}
              title="Random battle"
            >
              <Shuffle size={20} />
            </button>
          </div>
        )}

        <BattleStage />
        <BattleResult />
      </div>

      <footer>
        <div className="wrap">
          <ParaglideMessage
            message={m.app_footer}
            markup={{
              span: ({ children }) => <span>{children}</span>,
            }}
          />
          <br />
          <small>{m.app_footer_copyright({ year: new Date().getFullYear() })}</small>
        </div>
      </footer>

      <PokemonModal />
    </>
  );
}

function Header() {
  const locale = getLocale();
  const audioEnabled = useSettingsStore((s) => s.audio.enabled);
  const setAudioEnabled = useSettingsStore((s) => s.setAudioEnabled);

  return (
    <header>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ToggleGroup
          className="flex overflow-hidden rounded-lg"
          value={[locale]}
          onValueChange={(v) => {
            const next = v[0];
            if (next && next !== locale) {
              setLocale(next);
            }
          }}
          multiple={false}
        >
          <Toggle
            className="text-muted hover:bg-surface data-pressed:bg-accent/20 data-pressed:text-accent flex h-7 cursor-pointer items-center px-2 text-[11px] font-semibold tracking-wider uppercase transition-colors select-none"
            value="es"
          >
            ES
          </Toggle>
          <Toggle
            className="text-muted hover:bg-surface data-pressed:bg-accent/20 data-pressed:text-accent flex h-7 cursor-pointer items-center px-2 text-[11px] font-semibold tracking-wider uppercase transition-colors select-none"
            value="en"
          >
            EN
          </Toggle>
        </ToggleGroup>
        <button
          type="button"
          className="settings-gear"
          aria-label={audioEnabled ? "Mute audio" : "Unmute audio"}
          onClick={() => setAudioEnabled(!audioEnabled)}
          title={audioEnabled ? "Mute audio" : "Unmute audio"}
        >
          {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <Link to="/settings" className="settings-gear" aria-label={m.settings_title()}>
          <Settings size={20} />
        </Link>
      </div>
      <p className="eyebrow">{m.app_eyebrow()}</p>
      <h1>
        Poke
        <em>Ring</em>
      </h1>
      <p className="tagline">{m.app_tagline()}</p>
    </header>
  );
}
