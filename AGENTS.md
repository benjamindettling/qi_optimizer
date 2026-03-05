# Quantum Incursion Optimizer – Agent Guidelines

This file is read automatically by Codex before every task. Follow every rule here unless a specific task prompt explicitly overrides one.

---

## 1. Project Overview

**Quantum Incursion Optimizer (QIO)** is a React + Vite city-planning simulator. Players place buildings on a grid board, manage resources, navigate a time-step history tree, and export their city layout as a PDF. The frontend is entirely client-side; persistence is handled via Firebase and `localStorage`.

Key directories:
```
src/
  app/           – root wiring, layout, modal orchestration
  components/    – all UI components (TopBar, Board, ActionToolbar, modals, …)
  config/        – game constants and building definitions (JSON data files)
  domain/        – pure game-logic controllers (placement, production, regions, export)
  hooks/         – React hooks and game controller hooks
  i18n/          – translation dictionary and tutorial content
  context/       – React contexts (LanguageContext, …)
  utils/         – pure utility functions (math, formatting, layout, building name helpers)
  firebase/      – Firebase auth and account helpers
```

---

## 2. Non-Negotiable Architecture Rules

### 2.1 Board Rendering – SVG Only
The game board (`components/Board/Board.jsx`) is rendered **entirely in SVG**. This is required for PDF export (via `domain/export/pdfExport.js` and `domain/export/boardPrint.js`).

- **Never** replace SVG elements with HTML `<div>` / `<canvas>` or CSS-grid-based cell rendering.
- Any new board overlay, label, highlight, or indicator must also be SVG.
- When adding board-visible building labels, use `<text>` elements inside the SVG.
- The PDF export pipeline reads the live SVG DOM — changes that break SVG structure will silently break PDF export. Always check that new board features preserve the SVG output.

### 2.2 Bilingual Support (DE / EN) — Mandatory for Every New Feature
The app supports German and English via a `LanguageContext` (`src/context/LanguageContext.jsx`) and a central translation dictionary (`src/i18n/translations.js`).

**Every new user-facing string must be added in both languages.**

Rules:
- Add new keys to `src/i18n/translations.js` as `{ DE: "...", EN: "..." }` objects.
- Use `useLang()` from `LanguageContext` in components; derive a local `t(key)` helper.
- For non-component JS files (hooks, domain controllers), read `lang` from `localStorage.getItem("qi_lang") || "DE"` or accept `lang` as a parameter.
- **Never** hardcode a German or English string directly in JSX or JS — always go through the translation dictionary.
- German special characters **ä, ö, ü, Ä, Ö, Ü, ß** must be preserved exactly in all DE strings. Do not escape, strip, or transliterate them.
- English placeholder values (`"-"`) in building data JSON are intentional; do not "fix" them.

### 2.3 Building Name / Short-Name Access
Building definitions live in `src/config/data/*.json`. Each entry has:
```json
{ "name_DE": "...", "shortname_DE": "...", "name_EN": "-", "shortname_EN": "-" }
```

**Never** access `def.name` or `def.short` directly — these fields no longer exist. Always use:
```js
import { getBuildingName } from "../../utils/buildingName";
getBuildingName(def, lang, "name")   // full name
getBuildingName(def, lang, "short")  // abbreviation
```

Pass `lang` from the nearest `useLang()` call or from `localStorage`.

---

## 3. Code Style & Conventions

- **Framework:** React 18 with hooks only — no class components.
- **Build tool:** Vite. Do not add Webpack, CRA, or other bundlers.
- **Styling:** Plain CSS files co-located with components. No CSS-in-JS, no Tailwind, no Sass.
- **Colors:** Define all reusable colors, semantic color mappings, and exported CSS color variables in `src/config/colors.js`. Component CSS files may only consume existing color variables and must not introduce new hex/rgb/rgba color definitions.
- **Icons:** `lucide-react` for all UI icons. Do not introduce other icon libraries.
- **State:** Local `useState` / `useReducer` for component state; custom hooks in `src/hooks/gameController/` for game state. No Redux, Zustand, or other state libraries.
- **No TypeScript.** The project is plain JavaScript (.js / .jsx). Do not convert files or add `.ts` / `.tsx` files.
- **Formatting:** 2-space indentation, double quotes for JSX attributes, single quotes in JS. Match the surrounding file's style.
- **Imports:** Use relative imports. No path aliases (`@/`) unless one already exists in `vite.config.js`.

---

## 4. Data & Persistence

- **Firebase Firestore** is used for cloud save syncing and account data. Do not add a second database or ORM.
- **`localStorage`** is used for ephemeral UI preferences (language, toolbar position, collapsed state). Keys are prefixed `qi_`.
- **Save files** are plain JSON objects stored in Firestore and exported as `.json`. Do not change the save-file schema without updating both the writer and the reader and noting it clearly in the task PR.
- The `config/data/*.json` building files are static assets bundled at build time. They are not fetched at runtime.

---

## 5. Export / PDF Pipeline

`domain/export/pdfExport.js` and `boardPrint.js` walk the live SVG DOM to generate a multi-page PDF. Rules to protect this:

- Do not add `pointer-events: none` to SVG layers without checking that the export pipeline still captures them.
- Do not use CSS `transform` on the root `<svg>` element — use SVG `transform` attributes instead.
- Do not conditionally hide SVG layers using React state in a way that hides them during the export snapshot. Use CSS opacity or the existing `boardMask` mechanism.
- After adding any new board layer, test that `onPrintBoard` still produces the correct output.

---

## 6. Testing & Verification

There is no automated test suite for the UI. For every change:
1. Verify the feature works in both **DE** and **EN** language modes.
2. Verify the **board SVG renders correctly** (cells, labels, overlays).
3. Verify **save/load** round-trips do not corrupt state.
4. Verify **PDF export** (`onExportPdf`) still produces a valid output if the board was touched.
5. If building data JSON was changed, verify the **Shop sidebar**, **Board cell labels**, **Action Log**, and **History Tree** all show building names correctly.

There is a tiling solver unit test: `src/utils/tilingSolver.test.mjs`. Run it with:
```bash
node --experimental-vm-modules src/utils/tilingSolver.test.mjs
```

---

## 7. Things to Never Do

| ❌ Never | Reason |
|----------|--------|
| Replace SVG board rendering with HTML/Canvas | Breaks PDF export |
| Hardcode any user-visible string in DE or EN | Breaks bilingual support |
| Access `def.name` or `def.short` directly | Fields removed; use `getBuildingName()` |
| Add TypeScript or change file extensions to `.ts` | Not part of the stack |
| Introduce a new CSS framework or styling system | Breaks design consistency |
| Modify save-file JSON schema without dual reader/writer update | Corrupts saved games |
| Add a new UI without wiring it through `LanguageContext` | Untranslatable |
| Strip or replace German special characters (ä ö ü ß …) | Breaks German language mode |

---

## 8. Adding a New Building Category or Building

1. Add the entry to the appropriate `src/config/data/*.json` file using the full schema:
   ```json
   {
     "id": "my_building",
     "name_DE": "Mein Gebäude",
     "shortname_DE": "MG",
     "name_EN": "-",
     "shortname_EN": "-",
     ... (other fields)
   }
   ```
2. If it's a new category, add it to `src/config/categories.js` and `src/config/colors.js`.
3. Verify it appears correctly in the Shop sidebar, on the board, in the action log, and in the history tree.
4. If it has a new icon, place the `.webp` file in `public/` in the appropriate subfolder.

---

## 9. Adding a New Modal or UI Panel

1. Create the component in `src/components/modals/` or the relevant subfolder.
2. Wire it through `src/app/layout/AppModals.jsx` (for global modals) or inline in the relevant layout.
3. All heading, button label, placeholder, and tooltip strings go into `src/i18n/translations.js` with both DE and EN values.
4. Use `useLang()` inside the component to switch strings.
5. The modal must close on pressing `Escape` (use the existing modal CSS class pattern or `onClose` prop convention already used in the project).

---

## 10. Quick Reference – Key Files

| Purpose | File |
|---------|------|
| Language context & hook | `src/context/LanguageContext.jsx` |
| All UI translations | `src/i18n/translations.js` |
| Tutorial content (DE/EN JSX) | `src/i18n/tutorialContent.jsx` |
| Building name helper | `src/utils/buildingName.js` |
| Building data (JSON) | `src/config/data/*.json` |
| Board (SVG renderer) | `src/components/Board/Board.jsx` |
| PDF export | `src/domain/export/pdfExport.js` |
| Game controller root | `src/hooks/gameController/useGameController.js` |
| App root & routing | `src/app/AppRoot.jsx` |
| All modals wired together | `src/app/layout/AppModals.jsx` |
