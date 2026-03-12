# Quantum Incursion Optimizer — Agent Guidelines

> **This file is read automatically by Codex and other AI agents before every task.**
> Follow every rule here unless a specific task prompt explicitly overrides one.
> This document defines long-lived project standards — it must remain valid after any refactoring.

---

## 1 · Project Overview

**Quantum Incursion Optimizer (QIO)** is a client-side React + Vite city-planning simulator.
Players place buildings on an SVG grid board, manage resources (money, supplies, chronos, shards, quantum actions, goods, troops, population, happiness), navigate a branching time-step history tree, and export their city layout as a PDF.

Persistence uses **Firebase Firestore** for cloud saves and **`localStorage`** for ephemeral UI preferences. There is no server-side backend beyond Firebase.

### 1.1 Tech Stack

| Layer              | Technology                    | Notes                        |
| ------------------ | ----------------------------- | ---------------------------- |
| Framework          | React 19, hooks only          | No class components          |
| Build              | Vite                          | No Webpack, CRA, etc.        |
| Language           | Plain JavaScript (.js / .jsx) | No TypeScript                |
| Styling            | Co-located plain CSS          | No Tailwind, Sass, CSS-in-JS |
| Icons (UI)         | `lucide-react`                | No other icon libraries      |
| Icons (resources)  | `.webp` images in `public/`   | Inline via `<img>` tags      |
| Tree visualization | `@xyflow/react` + `d3`        | For history tree layout      |
| PDF generation     | `jspdf` + `svg2pdf.js`        | SVG → PDF pipeline           |
| Auth & cloud       | Firebase (auth + Firestore)   | No additional databases      |
| Routing            | `react-router-dom`            | Minimal routes               |

### 1.2 Source Directory Structure

```
src/
  app/           – root wiring (AppRoot), layout (AppLayout), modal orchestration (AppModals)
  components/    – all UI components, organized by feature area
  config/        – game constants, building definitions (JSON), color system, board config
  context/       – React contexts (LanguageContext, TutorialContext)
  domain/        – pure game-logic modules (economy, export, placement, production, regions, view)
  firebase/      – Firebase auth and account helpers
  hooks/         – React hooks; game controller split across hooks/gameController/
  i18n/          – translation dictionary (translations.js) and tutorial content (tutorialContent.jsx)
  state/         – snapshot utilities
  styles/        – shared CSS token files (base, controls, layout, modals, tokens)
  tutorial/      – tutorial step definitions and zone registry
  utils/         – pure utility functions (math, formatting, serialization, building name helpers)
```

### 1.3 UI Component Map

The simulator view consists of these logical sections:

| Section                     | Description                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **TopBar — Stats Tracker**  | Displays current resources (money, supplies, chronos, shards, QA, population, happiness, troops, fight stats) |
| **TopBar — Step Interface** | Step navigation arrows, checkpoint skip, step counter                                                         |
| **TopBar — Buttons**        | Save/load, export, settings, help, admin toggle                                                               |
| **Board Toolbar**           | Action buttons for the board: move, sell, boost, shop toggle, harvest, fast-forward                           |
| **Board Display**           | The SVG game board — 28×28 cell grid (7×7 regions of 4×4 cells)                                               |
| **Tree Toolbar**            | Controls for the history tree: zoom, focus, branch filtering, grouping                                        |
| **Tree Display**            | Visual branching history tree (React Flow)                                                                    |
| **Log**                     | Chronological action log showing build/sell/move/boost/harvest events                                         |
| **Additional Tools**        | Notes editor, region panel, expansion cost display, and other contextual panels                               |

---

## 2 · Non-Negotiable Architecture Rules

These rules protect core functionality. **Never** violate them without explicit approval.

### 2.1 Board Rendering — SVG Only

The game board is rendered **entirely in SVG** (`<rect>`, `<text>`, `<line>`, `<g>` elements).
This is a hard requirement because the PDF export pipeline reads the live SVG DOM.

- **Never** replace SVG elements with HTML `<div>`, `<canvas>`, or CSS-grid-based cell rendering.
- Any new board overlay, label, highlight, indicator, or decoration **must** be SVG.
- Building labels on the board use SVG `<text>` elements.
- Do not use CSS `transform` on the root `<svg>` — use SVG `transform` attributes instead.
- Do not use `pointer-events: none` on SVG layers without verifying the export pipeline still captures them.
- Do not conditionally hide SVG layers via React state in a way that hides them during the export snapshot — use CSS `opacity` or the existing `boardMask` mechanism instead.

### 2.2 Bilingual Support (DE / EN) — Mandatory From Day One

Every user-facing string must exist in both German and English. There are no exceptions.

**Architecture:**

- Central dictionary: `src/i18n/translations.js` — flat export `T` with keys mapping to `{ DE: "…", EN: "…" }`.
- Context: `src/context/LanguageContext.jsx` — provides `useLang()` hook returning `{ lang, setLang }`.
- In components: derive a local `t(key)` helper from `T` and `lang`.
- In non-component JS: accept `lang` as parameter, or read `localStorage.getItem("qi_lang") || "DE"`.
- Tutorial content: `src/i18n/tutorialContent.jsx` — JSX-based, bilingual.

**Rules:**

- **Never** hardcode a German or English string directly in JSX or JS — always go through the translation dictionary.
- Every new feature that renders text must add both DE and EN entries to `translations.js` before it is considered complete.
- German special characters **ä, ö, ü, Ä, Ö, Ü** must be preserved exactly in all DE strings.
- **Do not use "ß"** — always write "ss" instead (e.g., "schliessen" not "schließen", "Strasse" not "Straße", "Schiesspulver" not "Schießpulver"). This applies to all new code, translations, file names, and data. When modifying existing strings, replace "ß" with "ss" opportunistically.
- English placeholder values (`"-"`) in building data JSON are intentional — do not "fix" them.

### 2.3 Building Name / Short-Name Access

Building definitions live in `src/config/data/*.json`. Each entry has:

```json
{ "name_DE": "…", "shortname_DE": "…", "name_EN": "-", "shortname_EN": "-" }
```

**Never** access `def.name` or `def.short` directly — these fields do not exist. Always use:

```js
import { getBuildingName } from "../../utils/buildingName";
getBuildingName(def, lang, "name"); // full name
getBuildingName(def, lang, "short"); // abbreviation
```

Pass `lang` from the nearest `useLang()` call or from `localStorage`.

### 2.4 Single Color Source of Truth

**All** color definitions — hex codes, RGB/RGBA values, HSL values — must live in `src/config/colors.js`. No component, CSS file, or module may define its own color literals.

**`colors.js` structure:**

| Section                      | Purpose                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `PRIMARY_COLORS`             | Core named palette (green, blue, red, gold, gray, etc.)                                        |
| `BLUE_THEME` / `ADMIN_THEME` | 4-color base per theme (bg → surface → button → border)                                        |
| `createTheme()`              | Generates full semantic theme from 4 base colors                                               |
| `THEME_BLUE` / `THEME_ADMIN` | Concrete theme instances                                                                       |
| `SEMANTIC_COLORS`            | success / warning / error / info; positive / negative / neutral                                |
| `CATEGORY_COLORS`            | Building category colors (housing, production, goods, culture, decoration, military, townhall) |
| `ACTION_COLORS`              | History tree action colors (build, move, sell, boost, harvest, etc.)                           |
| `ACTION_LOG_COLORS`          | Action log entry color mapping                                                                 |
| `SAVEFILE_STATUS_COLORS`     | Save file sync state indicators                                                                |
| CSS variable generators      | `themeToCssVars()`, `uiColorsToCssVars()`, `applyThemeToDocument()`                            |

**Rules:**

- When a component needs a color, import it from `colors.js` or consume a CSS variable generated by `colors.js`.
- If a new color is needed, add it to the appropriate section of `colors.js` first, then reference it.
- Never introduce approximate duplicate colors — check the existing palette before adding new entries.
- CSS files consume color variables (`var(--color-…)`) and must not contain raw hex/rgb/rgba/hsl literals.

### 2.5 Shared Input Component

All user-editable input fields must use the shared `QiInput` component (`src/components/common/QiInput.jsx`).

- Supports `mode="text"` and `mode="number"` with automatic thousand-separator formatting (apostrophe `'`), min/max clamping, fallback values, and select-on-focus.
- Do not create one-off `<input>` elements with custom formatting, focus behavior, or styling.
- If `QiInput` lacks a needed capability, extend it rather than bypassing it.

### 2.6 Resource Keyword Icons

Game-resource keywords are always displayed with their corresponding `.webp` icon from `public/`. Whenever a resource keyword appears in the UI, it must be accompanied by its icon.

| Keyword              | Icon Path                    | Notes                                                      |
| -------------------- | ---------------------------- | ---------------------------------------------------------- |
| Money / Coins        | `/money.webp`                | Currency resource                                          |
| Supplies             | `/supplies.webp`             | Material resource                                          |
| Chronos              | `/chronos.webp`              | Time resource                                              |
| Shards               | `/shards.webp`               | Premium resource                                           |
| Quantum Actions (QA) | `/quantum_actions.webp`      | Special actions resource                                   |
| Population           | `/population.webp`           | Housing capacity                                           |
| Troops               | `/troop.webp`                | Military units                                             |
| Goods (generic)      | `/goods/{GoodName}.webp`     | Per-good icons (Kupfer, Honig, Stein, Seil, Schiesspulver) |
| Happiness            | `/happiness/{TierName}.webp` | Per-tier icons (Rebellisch through Enthusiastisch)         |
| Red Attack           | `/fight/red_attack.webp`     | Fight stat                                                 |
| Red Defense          | `/fight/red_defense.webp`    | Fight stat                                                 |
| Blue Attack          | `/fight/blue_attack.webp`    | Fight stat                                                 |
| Blue Defense         | `/fight/blue_defense.webp`   | Fight stat                                                 |
| Red Combined         | `/red_both_qi.webp`          | Combined fight icon                                        |
| Blue Combined        | `/blue_both_qi.webp`         | Combined fight icon                                        |
| Units                | `/units/{UnitName}.webp`     | Per-unit icons (Katapult, Blide, Kanone)                   |

Use `getGoodIconPath()` from `src/utils/goodsIconPath.js` for goods icons — it handles name normalization.

---

## 3 · Code Style & Conventions

### 3.1 General Principles

- **Readability over cleverness.** Prefer explicit, self-documenting code. Use descriptive variable and function names.
- **Single Responsibility.** Each file, function, and component should do one thing well.
- **DRY (Don't Repeat Yourself).** Extract shared logic into utility functions or custom hooks. Avoid copy-pasting code across components.
- **YAGNI (You Aren't Gonna Need It).** Do not add speculative abstractions. Build what is needed now.
- **Fail fast.** Validate inputs early. Use sensible defaults and fallbacks.

### 3.2 File & Folder Organization

- Components are organized by **feature area**, not by file type. Each feature folder contains its `.jsx` and `.css` files together.
- Shared/reusable components live in a dedicated `common/` folder.
- Pure utility functions (no React dependencies) belong in `src/utils/`.
- Pure game-logic modules (no UI dependencies) belong in `src/domain/`.
- React hooks belong in `src/hooks/`. The game controller is decomposed across `src/hooks/gameController/`.
- Configuration and static data belong in `src/config/`.

### 3.3 JavaScript & React Conventions

- **React hooks only** — no class components.
- **Functional components** with arrow functions or function declarations (match surrounding file style).
- **Formatting:** 2-space indentation. Double quotes for JSX attributes, single quotes in JS strings. Match the surrounding file's conventions.
- **Imports:** Relative imports only. No path aliases (`@/…`) unless configured in `vite.config.js`.
- **No TypeScript.** The project is plain `.js` / `.jsx`. Do not add `.ts` / `.tsx` files.
- **State management:** `useState` / `useReducer` for component-local state. Custom hooks in `hooks/gameController/` for game state. No Redux, Zustand, MobX, or other state libraries.
- **Prop drilling** is acceptable for 2-3 levels. For deeper sharing, use existing React Contexts or the game controller hook.
- **`useEffect` discipline:** Always specify correct dependency arrays. Clean up subscriptions and listeners. Avoid effects for derived state — compute it during render instead.
- **Memoization:** Use `useMemo` and `useCallback` only when there is a measurable performance need or when passing callbacks to heavily re-rendering children. Do not wrap everything by default.

### 3.4 CSS Conventions

- Plain CSS files, co-located with their component (e.g., `Board.css` alongside `Board.jsx`).
- CSS class naming: kebab-case, prefixed by component name to avoid collisions (e.g., `.board-cell`, `.topbar-stats`).
- All colors must reference CSS custom properties from `colors.js` — no inline hex/rgb literals.
- Shared CSS tokens (spacing, typography, transitions) live in `src/styles/tokens.css`.
- No CSS-in-JS, no Tailwind, no Sass, no CSS Modules.

### 3.5 Naming Conventions

| Item                | Convention              | Example                            |
| ------------------- | ----------------------- | ---------------------------------- |
| Components          | PascalCase              | `TopBarPager`, `ShopCard`          |
| Component files     | PascalCase `.jsx`       | `ShopSidebar.jsx`                  |
| Hooks               | `use` prefix, camelCase | `useGameController`, `useLang`     |
| Utility functions   | camelCase               | `getBuildingName`, `formatNumber`  |
| Constants           | UPPER_SNAKE_CASE        | `REGION_SIZE`, `PRIMARY_COLORS`    |
| CSS classes         | kebab-case              | `.board-toolbar`, `.modal-overlay` |
| Config / data files | camelCase or kebab-case | `boardConfig.js`, `housing.json`   |
| localStorage keys   | `qi_` prefix            | `qi_lang`, `qi_toolbar_pos`        |

### 3.6 Dead Code & Cleanup

- Do not leave commented-out code blocks in production files. Remove them.
- Do not leave unused imports, variables, or functions. ESLint will flag these.
- When refactoring removes a feature, delete all associated files, imports, and references — do not leave orphaned code.
- If a component or hook is no longer rendered/called anywhere, delete it.

---

## 4 · Data, Persistence & Export

### 4.1 Firebase & Cloud

- **Firebase Firestore** for cloud save syncing and account data. Do not add a second database or ORM.
- **Firebase Auth** for username-based authentication.
- Firebase configuration lives in `src/firebase.js`.

### 4.2 Local Storage

- Used for ephemeral UI preferences only (language, view mode, collapsed states).
- All keys are prefixed `qi_` (e.g., `qi_lang`, `qi_skipToEnd`).
- Never store game state in localStorage — use the save system.

### 4.3 Save Files — Minimal JSON Exports

Save files are plain JSON. The guiding principle is **minimal payload**:

- Export only the information that **cannot be reconstructed** from existing config and game rules.
- Derived values (resource totals, computed stats, building metadata that exists in `config/data/`) must **not** be stored in the save file.
- The tree serializer (`src/utils/treeSerializer.js`) uses compact single-letter action codes and index-based references to minimize file size.
- When adding new saveable state, always ask: "Can this be recomputed on load?" If yes, do not include it.
- Any change to the save schema **must** update both the serializer (writer) and the deserializer (reader). Backward compatibility with existing save files must be maintained.

### 4.4 Static Data

Building definitions (`src/config/data/*.json`) are static assets bundled at build time. They are not fetched at runtime.

Building JSON schema:

```json
{
  "id": "building_id",
  "name_DE": "Deutscher Name",
  "shortname_DE": "DN",
  "name_EN": "-",
  "shortname_EN": "-",
  "size": [2, 2],
  "cost": { "coins": 10000, "supplies": 0, "chronos": 0 },
  "people": 70,
  "coinBoost": 0,
  "production": { "coins": 12500, "supplies": 0, "chronos": 10 },
  "tier": 1
}
```

---

## 5 · Export & PDF Pipeline

### 5.1 Architecture

The PDF export pipeline converts the live SVG board into a multi-page PDF document:

1. `domain/export/pdfExport.js` — Orchestrates multi-page PDF generation. Walks the main branch of the history tree, captures board SVG as PNG for each section, and renders action logs and resource stats.
2. `domain/export/svgExport.js` — Shared SVG helpers: `waitForSvgReady()`, `getSvgDimensions()`, `serializeSvgNode()` (clones + inlines styles), `svgStringToPngDataUrl()`.
3. `domain/export/boardPrint.js` — Simple single-image PNG export of the current board state.
4. `domain/export/pdfText.js` — Renders build-plan notes into PDF with color-coded lines.

### 5.2 Rules

- The pipeline depends on the board being pure SVG. Any non-SVG elements in the board area will break export.
- After adding any new board layer or visual element, verify that `onPrintBoard` (PNG) and `onExportPdf` (PDF) still produce correct output.
- Do not use `flushSync` outside of the export pipeline — it is an intentional exception there to force-render board snapshots.

---

## 6 · Verification Checklist

There is no automated UI test suite. For every change, manually verify:

1. **Bilingual:** Feature works correctly in both DE and EN modes.
2. **Board rendering:** SVG board displays cells, labels, overlays, and highlights correctly.
3. **Save/load:** Round-trip save → export → import does not corrupt or lose state.
4. **PDF export:** `onExportPdf` produces valid output if the board was touched.
5. **Building display:** If building data changed, verify the Shop, Board labels, Action Log, and History Tree all render names correctly.
6. **Colors:** Any new visual elements use colors from `colors.js` — no hardcoded color values.
7. **Icons:** Resource keywords display their `.webp` icon.
8. **Input fields:** Any new inputs use `QiInput`.

### Unit Tests

Tiling solver unit test:

```bash
node --experimental-vm-modules src/utils/tilingSolver.test.mjs
```

---

## 7 · Prohibited Practices

| ❌ Never                                                             | Reason                                             |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| Replace SVG board with HTML/Canvas                                   | Breaks PDF export pipeline                         |
| Hardcode user-visible strings in DE or EN                            | Breaks bilingual support                           |
| Access `def.name` or `def.short` on building definitions             | Fields do not exist; use `getBuildingName()`       |
| Add TypeScript or `.ts` / `.tsx` files                               | Not part of the stack                              |
| Introduce CSS frameworks (Tailwind, Sass, CSS-in-JS, etc.)           | Breaks design consistency                          |
| Define color literals outside `colors.js`                            | Fragments the color system                         |
| Create custom `<input>` elements instead of using `QiInput`          | Breaks input consistency                           |
| Add state management libraries (Redux, Zustand, etc.)                | Custom hooks are the pattern                       |
| Use "ß" in any new or modified string                                | Project uses "ss" instead                          |
| Display a resource keyword without its icon                          | Breaks visual consistency                          |
| Include derived/reconstructable data in save files                   | Bloats exports; violates minimal-payload principle |
| Modify save schema without updating both serializer and deserializer | Corrupts existing saves                            |
| Add a new UI feature without both DE and EN translations             | Untranslatable                                     |
| Leave dead code, unused imports, or commented-out blocks             | Code hygiene                                       |
| Add icon libraries other than `lucide-react`                         | Consistency                                        |
| Use path aliases (`@/`) not configured in `vite.config.js`           | Import resolution                                  |

---

## 8 · How-To Guides

### 8.1 Adding a New Building or Category

1. Add the building entry to the appropriate `src/config/data/*.json` file using the full schema (see §4.4).
2. For a **new category**: add it to `src/config/categories.js` and add its color to `CATEGORY_COLORS` in `src/config/colors.js`.
3. Verify it appears correctly in: Shop sidebar, Board cell labels, Action Log, History Tree.
4. If it needs an icon, place the `.webp` file in the appropriate `public/` subfolder.

### 8.2 Adding a New Modal or UI Panel

1. Create the component in the relevant `src/components/` subfolder.
2. Wire it through `src/app/layout/AppModals.jsx` (for global modals) or inline in the relevant layout component.
3. Add all heading, button, placeholder, and tooltip strings to `src/i18n/translations.js` with both DE and EN values.
4. Use `useLang()` inside the component.
5. The modal must close on `Escape` — follow the existing `onClose` prop convention.

### 8.3 Adding a New Color

1. Determine which section of `colors.js` the color belongs to (primary palette, theme, semantic, category, action, etc.).
2. Add it to the appropriate object.
3. If it needs to be a CSS variable, add it to the relevant CSS variable generator function.
4. Reference it from components via the JS import or the CSS variable.

### 8.4 Adding a New Resource or Keyword Icon

1. Place the `.webp` icon in the appropriate `public/` subfolder.
2. If it is a goods type, add any name-normalization override to `src/utils/goodsIconPath.js`.
3. Import and reference the icon wherever the keyword is displayed.
4. Update the icon table in this document (§2.6).

### 8.5 Adding New Translations

1. Add the key to `src/i18n/translations.js`:
   ```js
   myNewKey: { DE: "Deutscher Text", EN: "English text" },
   ```
2. In the component, use `const { lang } = useLang()` and derive `t(key)` to access the string.
3. For non-component code, accept `lang` as a parameter or read from `localStorage.getItem("qi_lang") || "DE"`.

---

## 9 · Key Files Quick Reference

| Purpose                                        | File                                            |
| ---------------------------------------------- | ----------------------------------------------- |
| App root & routing                             | `src/app/AppRoot.jsx`                           |
| Main layout                                    | `src/app/layout/AppLayout.jsx`                  |
| Modal orchestration                            | `src/app/layout/AppModals.jsx`                  |
| Language context & `useLang()` hook            | `src/context/LanguageContext.jsx`               |
| All UI translations                            | `src/i18n/translations.js`                      |
| Tutorial content (DE/EN, JSX)                  | `src/i18n/tutorialContent.jsx`                  |
| Color system (single source of truth)          | `src/config/colors.js`                          |
| Board config (grid dimensions, regions, costs) | `src/config/boardConfig.js`                     |
| Game defaults (starting resources, config)     | `src/config/gameDefaults.js`                    |
| Building categories                            | `src/config/categories.js`                      |
| Building data (JSON)                           | `src/config/data/*.json`                        |
| Building name helper                           | `src/utils/buildingName.js`                     |
| Shared input component                         | `src/components/common/QiInput.jsx`             |
| Goods icon path helper                         | `src/utils/goodsIconPath.js`                    |
| Board SVG renderer                             | `src/components/Board/Board.jsx`                |
| Board toolbar (mode buttons)                   | `src/components/BoardToolbar/BoardToolbar.jsx`  |
| Log and tools panel                            | `src/components/LogAndTools/LogAndTools.jsx`    |
| TopBar (responsive pager)                      | `src/components/TopBar/TopBar.jsx`              |
| PDF export                                     | `src/domain/export/pdfExport.js`                |
| SVG export helpers                             | `src/domain/export/svgExport.js`                |
| Board PNG export                               | `src/domain/export/boardPrint.js`               |
| Tree serializer (save/load)                    | `src/utils/treeSerializer.js`                   |
| Save config & logic                            | `src/utils/saveConfig.js`                       |
| Game controller (composed)                     | `src/hooks/gameController/useGameController.js` |
| Game state hook                                | `src/hooks/gameController/useGameState.js`      |
| Controller return builder                      | `src/hooks/gameController/controllerReturn.js`  |
