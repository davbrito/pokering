# PokéRing — Enhancement Opportunities

> Comprehensive analysis of the PokéRing Pokémon battle simulator codebase.
> Generated: June 12, 2026

---

## 🔴 High Priority

### 1. No Error Boundaries or Error Feedback

The app silently swallows API errors in multiple places:

- **`src/game/combat.ts`** — `fetchSingleMove()` catches errors and returns `null` with zero user feedback
- **`src/game/components/PokemonModal.tsx`** — prefetch errors are caught with `/* ignore prefetch errors */`
- Missing a top-level `<ErrorBoundary>` wrapping the app
- No retry UI or "something went wrong" state for users

**Suggested fix:** Add React error boundaries, surface fetch errors via a toast/notification mechanism, and show inline error states in `PokemonModal` and the battle loading screen.

---

### 2. Missing Type Badge CSS for Several Pokémon Types

The CSS in `src/style/game.css` defines `.t-` classes for some types but is missing classes for:

| Missing Type | `TYPE_TAB_COLORS` reference in `data.ts` |
|-------------|------------------------------------------|
| `bug`       | ✅ Defined                                |
| `rock`      | ✅ Defined                                |
| `ghost`     | ✅ Defined                                |
| `dragon`    | ✅ Defined                                |
| `dark`      | ✅ Defined                                |
| `steel`     | ✅ Defined                                |
| `fairy`     | ✅ Defined                                |

The `TYPE_TAB_COLORS` object in `data.ts` defines colors for all 18 types (+ "all"), but the CSS badge classes are incomplete. Badges for these types will render without proper styling.

**Suggested fix:** Add the missing `.t-bug`, `.t-rock`, `.t-ghost`, `.t-dragon`, `.t-dark`, `.t-steel`, `.t-fairy` classes to `src/style/game.css`, following the existing pattern and deriving values from `TYPE_TAB_COLORS`.

---

### 3. React Compiler Plugin May Cause Build Issues

`babel-plugin-react-compiler` is installed as a dev dependency and configured in `vite.config.ts`:

```ts
babel({ presets: [reactCompilerPreset()] })
```

The React compiler (former React Forget) requires strict coding patterns (no mutating state, proper hook rules, stable component types). If the codebase doesn't follow these patterns — particularly the Zustand store mutations and the complex animation logic in `BattleStage.tsx` — it may produce incorrect compiled output or build warnings/errors.

**Suggested fix:** Either ensure all components follow compiler-safe patterns (use `useCallback`/`useMemo` properly, avoid closures with changing values), or remove the compiler plugin if it's not being actively validated in CI.

---

### 4. Type Safety: `any` Casting in API Layer

- **`src/game/api.ts`** — `(d.sprites.other as any)?.["official-artwork"]?.front_default` bypasses type checking
- The generated PokeAPI client types (`src/api/pokeapi/types.gen.ts`) may have incomplete or overly permissive types for nested sprite URLs

**Suggested fix:** Extend the generated types with proper interfaces for `official-artwork` and other sprite variants, replacing the `any` cast with a typed accessor.

---

## 🟡 Medium Priority

### 5. Unbounded Memory Cache (`localizedNameCache`)

The module-level `Map<number, Map<string, string>>` in `src/game/api.ts` is used as a localized name cache, populated by the `PokemonModal` preview panel on every hover.

**Issues:**
- Grows unboundedly — every hovered Pokémon adds entries that are never cleaned up
- With 1010+ Pokémon and multiple languages, this could consume significant memory over long sessions
- No eviction policy

**Suggested fix:** Add a maximum size limit (e.g., LRU cache using `Map` delete-reinsert pattern, or a dedicated LRU library), or clear entries when the modal closes.

---

### 6. Duplicated Stat Bar Rendering Logic

Both components have nearly identical stat bar rendering:

| Component | File |
|-----------|------|
| `PokemonCard` | `src/game/components/PokemonSlot.tsx` |
| `PokemonPreview` | `src/game/components/PokemonModal.tsx` |

Both duplicate:
- Same color thresholds (`>= 100 → #4ade80`, `>= 70 → #60d8a0`, `>= 45 → #f5c842`, else `#e63e3e`)
- Same bar layout (label + track + value)
- Same stat abbreviation mapping via `STAT_ABBR`

**Suggested fix:** Extract a shared `<StatBars stats={...} />` component used by both `PokemonCard` and `PokemonPreview`.

---

### 7. Hardcoded Spanish Locale in Settings

`src/routes/settings.tsx` uses:

```ts
const displayNames = new Intl.DisplayNames(["es"], { type: "language" });
```

This is hardcoded to Spanish. If the user's browser/OS language differs, language names in the selector won't match their expectations.

**Suggested fix:** Use `navigator.language` (with a fallback to `"es"`) for the `DisplayNames` constructor, so the UI adapts to the user's locale.

---

### 8. No Test Coverage

`vitest` and `@testing-library/react` are installed as dev dependencies and `pnpm test` is defined, but no test files exist in the repository.

The combat engine (`src/game/combat.ts`) has complex logic that would benefit significantly from unit tests:

| Function | Description |
|----------|-------------|
| `calculateAttackDamage()` | Damage formula with crits, STAB, type effectiveness, randomness |
| `getEffectiveness()` | Type chart lookup with accumulated multipliers |
| `getStabMultiplier()` | Same-type attack bonus calculation |
| `selectBestMove()` | AI move selection with randomness factor |
| `determineFirstAttacker()` | Speed-based turn order with tie-breaking |
| `generateBattleSteps()` | Full battle sequence generation |
| `fetchPokemonMoves()` | API data transformation and filtering |

**Suggested fix:** Add Vitest unit tests for the pure functions in `combat.ts` and `data.ts`.

---

### 9. Battle Dialog Text Overflow on Mobile

The `stage-dialog` battle narration can be lengthy (move names + crit messages + effectiveness text). On mobile (640px breakpoint), the text is set to `font-size: 11px`. Long names (e.g., "Hydro Pump", "Thunderbolt") combined with modifiers could overflow.

**Suggested fix:** Add `overflow-wrap: break-word` or `word-break: break-word` to `.stage-dialog`, and consider truncation for very long strings with a `title` tooltip.

---

### 10. Hardcoded English Fallback in Localization

`getLocalizedName()` in `src/game/api.ts` falls back to English (`"en"`) when the requested language is missing translations:

```ts
const en = names.find((n) => n.language.name === "en");
if (en) return en.name;
```

For a Spanish-first app (`lang="es"` on `<html>`), this means some Pokémon will show English names when Spanish translations are unavailable. Mixed-language display could be confusing.

**Suggested fix:** Consider showing the species API name key (e.g., `bulbasaur`) as a neutral fallback, or add a subtle visual indicator when falling back to a different language.

---

## 🟢 Low Priority / Nice-to-Have

### 11. Combat Depth Limitations

The engine has several simplifying design decisions that limit realism compared to the actual Pokémon games:

| Limitation | Impact |
|------------|--------|
| **No status moves** | Growl, Thunder Wave, Swords Dance, etc. are filtered out entirely |
| **No status conditions** | No burn (ATK halved), paralysis (speed halved), freeze, sleep, or poison |
| **No held items** | No berries, Choice items, or type-boosting items |
| **No abilities** | No Intimidate, Levitate, Sturdy, etc. |
| **No weather/terrain** | No rain, sun, sand, or electric terrain effects |
| **Fixed level 50** | No level-based variance between Pokémon |
| **15-turn cap** | Prevents stall strategies and long matches |

These are valid design choices for a lightweight simulator but represent the largest surface for feature enhancement.

---

### 12. No Keyboard Navigation for Pokémon Grid

The `.poke-thumb` buttons are focusable and have hover states, but the grid doesn't support arrow-key navigation. Users relying on keyboard navigation must tab through potentially hundreds of thumbnails.

**Suggested fix:** Add `role="grid"` with arrow-key event handlers to navigate between thumbnails, and ensure focus management when filtering/searching.

---

### 13. Missing SEO / Social Meta Tags

The app has no Open Graph or Twitter Card meta tags. When shared on social media, there's no preview image, title, or description.

**Suggested fix:** Add `<meta property="og:title" />`, `<meta property="og:description" />`, `<meta property="og:image" />` and Twitter Card equivalents in the route head configuration in `src/routes/__root.tsx`.

---

### 14. PWA / Offline Support Gap

A `public/manifest.json` exists but no service worker is registered. Combined with the existing TanStack Query localStorage persistence (`@tanstack/query-async-storage-persister`), a basic service worker could turn this into a functional offline PWA.

**Suggested fix:** Add a service worker (via `vite-plugin-pwa` or Workbox) and register it in the root route. The persisted query cache already handles data offline; a service worker would provide asset caching and full offline capability.

---

### 15. Settings Gear Animation

The `.settings-gear` hover in `src/style/game.css` uses:

```css
.settings-gear:hover {
  transform: rotate(60deg);
}
```

The rotation amount (60°) is small for a gear icon — a full 360° spin would feel more satisfying and natural.

**Suggested fix:** Change to `transform: rotate(360deg)` for a full spin effect.

---

### 16. TypeScript `strict` Mode Gaps

The `tsconfig.json` has `"strict": true` and `"noUncheckedSideEffectImports": true`, but several files use loose patterns:

- `(d.sprites.other as any)` type escapes in `src/game/api.ts`
- `window.crypto.getRandomValues(array)` in `src/game/combat.ts` (should use `crypto.getRandomValues`)
- The generated PokeAPI client is excluded from linting (`!src/api/pokeapi/**` in `biome.json`)

**Suggested fix:** Audit and fix strict TS errors across `src/game/` and `src/routes/` to fully leverage strict mode benefits, and ensure the generated types are compatible.

---

## 💡 Quick Wins Summary

| # | Opportunity | File(s) | Est. Effort |
|---|-------------|---------|-------------|
| 6 | Extract shared `<StatBars>` component | `PokemonSlot.tsx`, `PokemonModal.tsx` | ~30 min |
| 4 | Fix `any` cast for artwork URL | `game/api.ts` | ~15 min |
| 15 | Full 360° gear spin | `style/game.css` | ~2 min |
| 10 | Better localization fallback strategy | `game/api.ts` | ~20 min |
| 5 | Add LRU limit to `localizedNameCache` | `game/api.ts` | ~30 min |
| 8 | Add unit tests for combat engine | `game/combat.ts` | ~2–3 hours |
| 7 | Respect browser locale in settings | `routes/settings.tsx` | ~10 min |
| 2 | Add missing type badge CSS classes | `style/game.css` | ~10 min |
| 9 | Mobile dialog overflow protection | `style/game.css` | ~5 min |
| 13 | Add SEO / social meta tags | `routes/__root.tsx` | ~20 min |
| 12 | Arrow-key navigation for Pokémon grid | `PokemonModal.tsx` | ~45 min |
| 1 | Add error boundaries | New file + root route | ~1 hour |
| 14 | Add service worker for PWA | New file + config | ~1–2 hours |
| 11 | Combat depth enhancements | `game/combat.ts`, `game/data.ts` | Ongoing |

---

*Generated for the [PokéRing](https://github.com/davbrito/pokering) project.*
