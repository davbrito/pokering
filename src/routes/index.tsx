import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import { getLocale, setLocale } from "#/i18n/paraglide/runtime.js";
import { fetchPokemonMoves, generateBattleSteps, getStatsObject, scaleStatsByLevel } from "../game/combat";
import { BattleResult } from "../game/components/BattleResult";
import { BattleStage } from "../game/components/BattleStage";
import { PokemonModal } from "../game/components/PokemonModal";
import { PokemonSlot } from "../game/components/PokemonSlot";
import { useBothReady, useChosenPokemon, useGameStore } from "../game/store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const battlePhase = useGameStore((s) => s.battle.phase);
  const isLoadingMoves = useGameStore((s) => s.battle.isLoadingMoves);
  const bothReady = useBothReady();
  const { chosen } = useChosenPokemon();

  const { queryClient } = Route.useRouteContext();

  const startBattle = async () => {
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
    const { players } = useGameStore.getState();
    const level1 = players.player1.level;
    const level2 = players.player2.level;
    const scaled1 = scaleStatsByLevel(s1, level1);
    const scaled2 = scaleStatsByLevel(s2, level2);
    const mh1 = scaled1.hp;
    const mh2 = scaled2.hp;

    const {
      setMaxHealths,
      setCurrentHps,
      setBattleLogs,
      setCurrentStepIdx,
      setIsPaused,
      setBattlePhase,
      setIsLoadingMoves,
    } = useGameStore.getState();
    setMaxHealths([mh1, mh2]);
    setCurrentHps([mh1, mh2]);

    const steps = generateBattleSteps(
      poke1,
      poke2,
      s1,
      s2,
      mh1,
      mh2,
      p1Moves,
      p2Moves,
      undefined,
      undefined,
      level1,
      level2,
    );
    setBattleLogs(steps);
    setCurrentStepIdx(0);
    setIsPaused(false);
    setIsLoadingMoves(false);
    setBattlePhase("battle");

    setTimeout(() => {
      const stage = document.getElementById("stageContainer");
      stage?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const goBackToSelection = useCallback(() => {
    useGameStore.getState().setBattlePhase("selection");
  }, []);

  return (
    <>
      <div className="wrap">
        <Header />

        {battlePhase === "selection" ? (
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
                <button className="battle-btn" id="battleBtn" disabled={!bothReady} type="button" onClick={startBattle}>
                  {m.home_start_battle()}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="battle-section" id="battleSection">
            <button className="battle-btn" type="button" onClick={goBackToSelection}>
              {m.home_new_battle()}
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
            className="flex h-7 cursor-pointer select-none items-center px-2 font-semibold text-[11px] text-muted uppercase tracking-wider transition-colors hover:bg-surface data-pressed:bg-accent/20 data-pressed:text-accent"
            value="es"
          >
            ES
          </Toggle>
          <Toggle
            className="flex h-7 cursor-pointer select-none items-center px-2 font-semibold text-[11px] text-muted uppercase tracking-wider transition-colors hover:bg-surface data-pressed:bg-accent/20 data-pressed:text-accent"
            value="en"
          >
            EN
          </Toggle>
        </ToggleGroup>
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
