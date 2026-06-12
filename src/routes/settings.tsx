import { Select } from "@base-ui/react/select";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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

  const langItems =
    data?.map((lang) => ({
      label: lang.name,
      value: lang.name,
    })) ?? [];

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
            <div className="flex items-center gap-2 py-8 text-sm text-neutral-500">
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
                <Select.Label className="text-xs font-semibold text-muted mb-1.5 block cursor-default">
                  Idioma
                </Select.Label>
                <Select.Trigger className="flex h-10 w-full items-center justify-between gap-3 pl-3 pr-2 text-sm leading-none whitespace-nowrap border border-border-2 bg-neutral-950 text-white rounded-lg select-none hover:not-data-disabled:bg-surface active:not-data-disabled:bg-surface data-popup-open:border-accent font-normal focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-1">
                  <Select.Value className="data-placeholder:text-muted capitalize" placeholder="Seleccionar idioma" />
                  <Select.Icon className="flex text-muted shrink-0">
                    <CaretUpDownIcon />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner className="outline-hidden z-50" sideOffset={4}>
                    <Select.Popup className="group min-w-(--anchor-width) origin-(--transform-origin) border border-border-2 bg-surface text-white rounded-lg shadow-xl shadow-black/40 py-1 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.95] data-ending-style:opacity-0 data-starting-style:scale-[0.95] data-starting-style:opacity-0 data-[side=none]:translate-y-px data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:transition-none data-[side=none]:scale-100 data-[side=none]:opacity-100">
                      <Select.ScrollUpArrow className="flex h-4 w-full items-center justify-center text-muted z-1 relative">
                        <CaretUpIcon />
                      </Select.ScrollUpArrow>
                      <Select.List className="relative py-0.5 overflow-y-auto max-h-(--available-height) scroll-py-6">
                        {data?.map((lang) => {
                          const displayName = displayNames.of(lang.name) || lang.name;
                          return (
                            <Select.Item
                              key={lang.name}
                              value={lang.name}
                              className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 py-1.5 pr-4 pl-2.5 text-sm outline-hidden select-none scroll-my-0.5 mx-1 rounded-md data-selected:bg-accent/15 [@media(hover:hover)]:data-highlighted:bg-surface-2"
                            >
                              <Select.ItemIndicator className="col-start-1 flex items-center justify-center text-accent">
                                <CheckIcon />
                              </Select.ItemIndicator>
                              <Select.ItemText className="col-start-2 flex items-center gap-2">
                                <span className="font-mono text-[10px] uppercase text-muted min-w-14">{lang.name}</span>
                                <span className="capitalize text-sm font-medium">{displayName}</span>
                              </Select.ItemText>
                            </Select.Item>
                          );
                        })}
                      </Select.List>
                      <Select.ScrollDownArrow className="flex h-4 w-full items-center justify-center text-muted z-1 relative">
                        <CaretDownIcon />
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

function CaretUpDownIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: "block", ...props.style }}
    >
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}
function CaretUpIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: "block", ...props.style }}
    >
      <path d="M12 10H4l4-4.5z" />
    </svg>
  );
}
function CaretDownIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: "block", ...props.style }}
    >
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}
function CheckIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: "block", ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
