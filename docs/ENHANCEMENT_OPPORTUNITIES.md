# PokéRing — Enhancement Opportunities

> Comprehensive analysis of the PokéRing Pokémon battle simulator codebase.
> Generated: June 12, 2026 · Reviewed against the code: November 13, 2026

---

## 📝 Notes

- **React Compiler:** it is enabled through `@vitejs/plugin-react`'s native Oxc integration in `vite.config.ts` (`react({ compiler: { logDiagnostics: true } })`). The Oxc integration is experimental, so keep an eye on compiler diagnostics and verify behavior in production builds.

---

## 🔴 High Priority

### 1. No Error Boundaries or Error Feedback

The app silently swallows API errors in multiple places:

- **`src/game/combat.ts`** — `fetchSingleMove()` catches errors and returns `null` with zero user feedback
- **`src/game/components/PokemonModal.tsx`** — prefetch errors are reportedly ignored (verify; the `/* ignore prefetch errors */` comment was not found)
- Missing a top-level `<ErrorBoundary>` / route `errorComponent` wrapping the app
- No retry UI or "something went wrong" state for users

**Suggested fix:** Add React error boundaries, surface fetch errors via a toast/notification mechanism, and show inline error states in `PokemonModal` and the battle loading screen.

---

## 🟡 Medium Priority

### 2. Unbounded Memory Cache (`localizedNameCache`)

The module-level `Map<number, Map<string, string>>` in `src/game/api.ts` is used as a localized name cache, populated by the `PokemonModal` preview panel on every hover. It is read by `PokemonName.tsx` and cleared in `settings.tsx` when the language changes.

**Issues:**
- Grows unboundedly — every hovered Pokémon adds entries that are never cleaned up
- With 1010+ Pokémon and multiple languages, this could consume significant memory over long sessions
- No eviction policy

**Suggested fix:** Add a maximum size limit (e.g., LRU cache using `Map` delete-reinsert pattern, or a dedicated LRU library). Keep `PokemonName.tsx` working, since it reads the cache directly.

---

### 3. Duplicated Stat Bar Rendering Logic

Both components have nearly identical stat bar rendering:

| Component | File |
|-----------|------|
| `PokemonCard` | `src/game/components/PokemonSlot.tsx` |
| `PokemonPreview` | `src/game/components/PokemonPreview.tsx` |

Both duplicate:
- The same four-step color scale (`#4ade80` / `#60d8a0` / `#f5c842` / `#e63e3e`), but with **different thresholds**: `PokemonPreview` uses raw base stat (`>= 100 / 70 / 45`), `PokemonSlot` uses percentages (`>= 55 / 38 / 25`)
- Same bar layout (label + track + value)
- Same stat abbreviation mapping via `STAT_ABBR`

`BattleResult.tsx` also hardcodes `#4ade80` / `#e63e3e`; `--green` already exists in `src/styles.css`.

**Suggested fix:** Extract a shared `<StatBars stats={...} />` component after deciding on one scale (or parameterizing the thresholds), and use CSS variables for the colors.

---

### 4. Hardcoded Spanish Locale in Settings

`src/routes/settings.tsx` uses:

```ts
const displayNames = new Intl.DisplayNames(["es"], { type: "language" });
```

This is hardcoded to Spanish, so language names in the selector don't follow the UI language.

**Suggested fix:** Use the app's active locale (Paraglide) for the `DisplayNames` constructor, with `"es"` as the fallback.

---

### 5. Test Coverage Gaps

`vitest` and `@testing-library/react` are set up, and 14 test files exist under `test/` (combat, machines, status effects, move AI, stats scaling, UI). Remaining gaps in `src/game/combat.ts` and `src/game/combat/moves.ts`:

| Function | Status |
|----------|--------|
| `calculateAttackDamage()` | No direct test references |
| `getEffectiveness()` / `getStabMultiplier()` | No direct test references |
| `fetchPokemonMovePool()` | No direct test references |
| `determineFirstAttacker()`, `generateBattleSteps()` | Covered in `test/game/combat.test.ts` |

**Suggested fix:** Add focused unit tests for the uncovered pure functions (damage formula with crits/STAB/effectiveness, type chart lookup).

---

### 6. Battle Dialog Text Overflow on Mobile

The `stage-dialog` battle narration can be lengthy (move names + crit messages + effectiveness text). On mobile (640px breakpoint), the text is set to `font-size: 11px`, and `.stage-dialog` has no `overflow-wrap`.

**Suggested fix:** Add `overflow-wrap: break-word` to `.stage-dialog`.

---

### 7. Hardcoded English Fallback in Localization

`getLocalizedName()` in `src/game/api.ts` falls back to English (`"en"`) when the requested language is missing translations:

```ts
const en = names.find((n) => n.language.name === "en");
if (en) return en.name;
```

For a Spanish-first app (`lang="es"` on `<html>`), some Pokémon will show English names when Spanish translations are unavailable.

**Suggested fix:** Consider showing the species API name key (e.g., `bulbasaur`) as a neutral fallback, or add a subtle visual indicator when falling back to a different language.

---

## 🟢 Low Priority / Nice-to-Have

### 8. Combat Depth Limitations

The engine already supports status moves (stat changes, healing), burn and paralysis (`SUPPORTED_AILMENTS`), and level-based stat scaling. Remaining gaps compared to the actual games:

| Limitation | Impact |
|------------|--------|
| **Limited ailments** | Only burn and paralysis; no freeze, sleep or poison |
| **No held items** | No berries, Choice items, or type-boosting items |
| **No abilities** | No Intimidate, Levitate, Sturdy, etc. |
| **No weather/terrain** | No rain, sun, sand, or electric terrain effects |

---

### 9. No Keyboard Navigation for Pokémon Grid

The `.poke-thumb` buttons are focusable, but the grid doesn't support arrow-key navigation. Users relying on keyboard navigation must tab through potentially hundreds of thumbnails.

**Suggested fix:** Add `role="grid"` with arrow-key event handlers to navigate between thumbnails, and ensure focus management when filtering/searching.

---

### 10. Missing SEO / Social Meta Tags

The root route `head()` only defines charset, viewport and title. There are no Open Graph or Twitter Card tags.

**Suggested fix:** Add `og:title`, `og:description`, `og:image` and Twitter Card equivalents in the `head()` config in `src/routes/__root.tsx`.

---

### 11. PWA / Offline Support Gap

A `public/manifest.json` exists but no service worker is registered. Combined with the existing TanStack Query persistence (`@tanstack/query-async-storage-persister`), a basic service worker could turn this into a functional offline PWA.

**Suggested fix:** Add a service worker (via `vite-plugin-pwa` or Workbox) and register it in the root route.

---

### 12. Settings Gear Animation

`.settings-gear:hover` in `src/style/game.css` rotates only `60deg`. A full `360deg` spin might feel more natural (a matter of taste).

---

### 13. Linting Excludes the Generated API Client

`biome.json` excludes `src/api/pokeapi/**` from linting, and `src/routeTree.gen.ts` contains `as any` casts (generated code). Make sure the generated types remain compatible with strict TypeScript.

---

## 💡 Quick Wins Summary

| # | Opportunity | File(s) | Est. Effort |
|---|-------------|---------|-------------|
| 3 | Extract shared `<StatBars>` component | `PokemonSlot.tsx`, `PokemonPreview.tsx` | ~30 min |
| 12 | Full 360° gear spin | `style/game.css` | ~2 min |
| 7 | Better localization fallback strategy | `game/api.ts` | ~20 min |
| 2 | Add LRU limit to `localizedNameCache` | `game/api.ts` | ~30 min |
| 5 | Add unit tests for uncovered combat functions | `game/combat.ts` | ~1–2 hours |
| 4 | Use app locale in settings | `routes/settings.tsx` | ~10 min |
| 6 | Mobile dialog overflow protection | `style/game.css` | ~5 min |
| 10 | Add SEO / social meta tags | `routes/__root.tsx` | ~20 min |
| 9 | Arrow-key navigation for Pokémon grid | `PokemonModal.tsx` | ~45 min |
| 1 | Add error boundaries | New file + root route | ~1 hour |
| 11 | Add service worker for PWA | New file + config | ~1–2 hours |
| 8 | Combat depth enhancements | `game/combat.ts`, `game/data.ts` | Ongoing |

---

*Generated for the [PokéRing](https://github.com/davbrito/pokering) project.*
