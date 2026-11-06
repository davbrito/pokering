import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import { getLocale, setLocale } from "#/i18n/paraglide/runtime.js";
import { BattleResult } from "../game/components/BattleResult";
import { BattleStage } from "../game/components/BattleStage";
import { GameControls } from "../game/components/GameControls";
import { PokemonModal } from "../game/components/PokemonModal";
import { PokemonSlot } from "../game/components/PokemonSlot";
import { GameProvider, useGamePhase } from "../game/game-actor";
import { useSettingsStore } from "../game/settings-store";

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
  const phase = useGamePhase();

  useEffect(() => {
    if (phase === "battle") {
      document.getElementById("stageContainer")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [phase]);

  return (
    <>
      <div className="wrap isolate">
        <Header />

        {phase === "selection" || phase === "loading" ? (
          <div className="arena-grid" id="arenaGrid">
            <PokemonSlot index={0} label={m.home_fighter_1()} />
            <div className="vs-col">
              <div className="vs-line" />
              <div className="vs-txt">VS</div>
              <div className="vs-line" />
            </div>
            <PokemonSlot index={1} label={m.home_fighter_2()} />
          </div>
        ) : null}
        <GameControls />

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
