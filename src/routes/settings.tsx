import { Select } from "@base-ui/react/select";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { languageListOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import { localizedNameCache } from "../game/api";
import { useGameStore } from "../game/store";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const currentLang = useGameStore((s) => s.pokemonLanguage);
  const setPokemonLanguage = useGameStore((s) => s.setPokemonLanguage);

  const { data, isLoading } = useQuery({
    ...languageListOptions({ query: { limit: 100 } }),
    staleTime: 10 * 60 * 1000,
    select: (d) => d.results.map((l) => ({ name: l.name, url: l.url })).sort((a, b) => a.name.localeCompare(b.name)),
  });

  const displayNames = new Intl.DisplayNames(["es"], { type: "language" });

  return (
    <div className="settings-page">
      <div className="wrap">
        <header className="settings-header">
          <Link to="/" className="settings-back">
            ← Volver
          </Link>
          <h1>Ajustes</h1>
        </header>

        <section className="settings-section">
          <h2 className="settings-section-title">Idioma de los Pokémon</h2>
          <p className="settings-desc">
            Elige el idioma en el que se mostrarán los nombres de los Pokémon en el selector y la previsualización.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-neutral-500 text-sm">
              <div className="spinner" />
              <span>Cargando idiomas…</span>
            </div>
          ) : (
            <div className="max-w-sm">
              <Select.Root
                value={currentLang}
                itemToStringLabel={(item) => displayNames.of(item) || item}
                onValueChange={(value) => {
                  const lang = value as string;
                  setPokemonLanguage(lang);
                  localizedNameCache.clear();
                }}
              >
                <Select.Label className="mb-1.5 block cursor-default font-semibold text-muted text-xs">
                  Idioma
                </Select.Label>
                <Select.Trigger className="flex h-10 w-full select-none items-center justify-between gap-3 whitespace-nowrap rounded-lg border border-border-2 bg-neutral-950 pr-2 pl-3 font-normal text-sm text-white leading-none hover:not-data-disabled:bg-surface focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-1 active:not-data-disabled:bg-surface data-popup-open:border-accent">
                  <Select.Value className="capitalize data-placeholder:text-muted" placeholder="Seleccionar idioma" />
                  <Select.Icon className="flex shrink-0 text-muted">
                    <ChevronsUpDown size={16} />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner className="z-50 outline-hidden" sideOffset={4}>
                    <Select.Popup className="group min-w-(--anchor-width) origin-(--transform-origin) rounded-lg border border-border-2 bg-surface py-1 text-white shadow-black/40 shadow-xl outline-hidden transition-[scale,opacity] duration-100 ease-out data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:translate-y-px data-[side=none]:scale-100 data-ending-style:scale-[0.95] data-starting-style:scale-[0.95] data-[side=none]:opacity-100 data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=none]:transition-none">
                      <Select.ScrollUpArrow className="relative z-1 flex h-4 w-full items-center justify-center text-muted">
                        <ChevronUp size={14} />
                      </Select.ScrollUpArrow>
                      <Select.List className="relative max-h-(--available-height) scroll-py-6 overflow-y-auto py-0.5">
                        {data?.map((lang) => {
                          const displayName = displayNames.of(lang.name) || lang.name;
                          return (
                            <Select.Item
                              key={lang.name}
                              value={lang.name}
                              className="mx-1 grid cursor-default select-none scroll-my-0.5 grid-cols-[1rem_1fr] items-center gap-2 rounded-md py-1.5 pr-4 pl-2.5 text-sm outline-hidden data-selected:bg-accent/15 [@media(hover:hover)]:data-highlighted:bg-surface-2"
                            >
                              <Select.ItemIndicator className="col-start-1 flex items-center justify-center text-accent">
                                <Check size={14} />
                              </Select.ItemIndicator>
                              <Select.ItemText className="col-start-2 flex items-center gap-2">
                                <span className="min-w-14 font-mono text-[10px] text-muted uppercase">{lang.name}</span>
                                <span className="font-medium text-sm capitalize">{displayName}</span>
                              </Select.ItemText>
                            </Select.Item>
                          );
                        })}
                      </Select.List>
                      <Select.ScrollDownArrow className="relative z-1 flex h-4 w-full items-center justify-center text-muted">
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
          <h2 className="settings-section-title">Acerca de</h2>
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
