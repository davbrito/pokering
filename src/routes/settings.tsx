import { Select } from "@base-ui/react/select";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, ChevronsUpDown, ChevronUp, Volume2, VolumeX } from "lucide-react";
import { m } from "#/i18n/paraglide/messages.js";
import { getLocale, setLocale } from "#/i18n/paraglide/runtime.js";
import { languageListOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import { useSettingsStore } from "../game/settings-store";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const currentLang = useSettingsStore((s) => s.pokemonLanguage);
  const setPokemonLanguage = useSettingsStore((s) => s.setPokemonLanguage);

  const { data, isLoading } = useQuery({
    ...languageListOptions({ query: { limit: 100 } }),
    staleTime: 10 * 60 * 1000,
    select: (d) => d.results.toSorted((a, b) => a.name.localeCompare(b.name)),
  });

  const audioEnabled = useSettingsStore((s) => s.audio.enabled);
  const audioVolume = useSettingsStore((s) => s.audio.volume);
  const setAudioEnabled = useSettingsStore((s) => s.setAudioEnabled);
  const setAudioVolume = useSettingsStore((s) => s.setAudioVolume);

  const displayNames = new Intl.DisplayNames([getLocale()], { type: "language" });

  return (
    <div className="settings-page">
      <div className="wrap">
        <header className="settings-header">
          <Link to="/" className="settings-back">
            <ArrowLeft size={16} />
            {m.settings_back()}
          </Link>
          <h1>{m.settings_title()}</h1>
        </header>

        <section className="settings-section">
          <h2 className="settings-section-title">{m.settings_ui_language()}</h2>
          <p className="settings-desc">{m.settings_ui_language_desc()}</p>
          <ToggleGroup
            className="flex gap-2"
            value={[getLocale()]}
            onValueChange={(v) => {
              const next = v[0];
              if (next && next !== getLocale()) {
                setLocale(next);
              }
            }}
            multiple={false}
          >
            <Toggle
              className="border-border-2 text-muted hover:bg-surface data-pressed:border-accent data-pressed:text-accent flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-neutral-950 px-4 text-sm font-medium transition-colors select-none"
              value="es"
            >
              ES
            </Toggle>
            <Toggle
              className="border-border-2 text-muted hover:bg-surface data-pressed:border-accent data-pressed:text-accent flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-neutral-950 px-4 text-sm font-medium transition-colors select-none"
              value="en"
            >
              EN
            </Toggle>
          </ToggleGroup>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{m.settings_pokemon_language()}</h2>
          <p className="settings-desc">{m.settings_pokemon_language_desc()}</p>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-neutral-500">
              <div className="spinner" />
              <span>{m.settings_loading()}</span>
            </div>
          ) : (
            <div className="max-w-sm">
              <Select.Root
                value={currentLang}
                itemToStringLabel={(item) => displayNames.of(item) || item}
                onValueChange={(value) => {
                  const lang = value as string;
                  setPokemonLanguage(lang);
                }}
              >
                <Select.Label className="text-muted mb-1.5 block cursor-default text-xs font-semibold">
                  {m.settings_language_label()}
                </Select.Label>
                <Select.Trigger className="border-border-2 hover:not-data-disabled:bg-surface focus-visible:outline-accent active:not-data-disabled:bg-surface data-popup-open:border-accent flex h-10 w-full items-center justify-between gap-3 rounded-lg border bg-neutral-950 pr-2 pl-3 text-sm leading-none font-normal whitespace-nowrap text-white select-none focus-visible:outline-2 focus-visible:-outline-offset-1">
                  <Select.Value
                    className="data-placeholder:text-muted capitalize"
                    placeholder={m.settings_language_placeholder()}
                  />
                  <Select.Icon className="text-muted flex shrink-0">
                    <ChevronsUpDown size={16} />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner className="z-50 outline-hidden" sideOffset={4}>
                    <Select.Popup className="group border-border-2 bg-surface min-w-(--anchor-width) origin-(--transform-origin) rounded-lg border py-1 text-white shadow-xl shadow-black/40 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.95] data-ending-style:opacity-0 data-starting-style:scale-[0.95] data-starting-style:opacity-0 data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:translate-y-px data-[side=none]:scale-100 data-[side=none]:opacity-100 data-[side=none]:transition-none">
                      <Select.ScrollUpArrow className="text-muted relative z-1 flex h-4 w-full items-center justify-center">
                        <ChevronUp size={14} />
                      </Select.ScrollUpArrow>
                      <Select.List className="relative max-h-(--available-height) scroll-py-6 overflow-y-auto py-0.5">
                        {data?.map((lang) => {
                          const displayName = displayNames.of(lang.name) || lang.name;
                          return (
                            <Select.Item
                              key={lang.name}
                              value={lang.name}
                              className="data-selected:bg-accent/15 [@media(hover:hover)]:data-highlighted:bg-surface-2 mx-1 grid cursor-default scroll-my-0.5 grid-cols-[1rem_1fr] items-center gap-2 rounded-md py-1.5 pr-4 pl-2.5 text-sm outline-hidden select-none"
                            >
                              <Select.ItemIndicator className="text-accent col-start-1 flex items-center justify-center">
                                <Check size={14} />
                              </Select.ItemIndicator>
                              <Select.ItemText className="col-start-2 flex items-center gap-2">
                                <span className="text-muted min-w-14 font-mono text-[10px] uppercase">{lang.name}</span>
                                <span className="text-sm font-medium capitalize">{displayName}</span>
                              </Select.ItemText>
                            </Select.Item>
                          );
                        })}
                      </Select.List>
                      <Select.ScrollDownArrow className="text-muted relative z-1 flex h-4 w-full items-center justify-center">
                        <ChevronDown size={14} />
                      </Select.ScrollDownArrow>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>
          )}
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{m.settings_audio_title()}</h2>
          <p className="settings-desc">{m.settings_audio_desc()}</p>

          <div className="flex items-center gap-3">
            <button type="button" className="audio-toggle-btn" onClick={() => setAudioEnabled(!audioEnabled)}>
              {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span>{audioEnabled ? m.settings_audio_on() : m.settings_audio_off()}</span>
            </button>
          </div>

          {audioEnabled && (
            <div className="mt-4 max-w-xs">
              <label htmlFor="audio-volume" className="text-muted mb-1.5 block text-xs font-semibold">
                {m.settings_audio_volume()}
              </label>
              <input
                id="audio-volume"
                type="range"
                min={0}
                max={100}
                value={Math.round(audioVolume * 100)}
                onChange={(e) => setAudioVolume(Number(e.target.value) / 100)}
                className="audio-slider w-full"
              />
              <span className="text-muted mt-1 block font-mono text-[11px]">{Math.round(audioVolume * 100)}%</span>
            </div>
          )}
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{m.settings_about()}</h2>
          <p className="settings-desc">
            Los nombres traducidos provienen de la{" "}
            <a href="https://pokeapi.co" target="_blank" rel="noopener noreferrer">
              PokeAPI
            </a>
            . No todos los idiomas tienen traducciones para todas las especies.
          </p>
        </section>
      </div>
    </div>
  );
}
