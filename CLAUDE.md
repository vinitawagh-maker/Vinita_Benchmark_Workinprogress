# CLAUDE.md

This file provides guidance for working with code in this repository. Use domain-specific agents to reduce context when working on ESDC, Escalation, or Costs.

## Project Overview

**WBS Terminal v2.0** – Vite-powered web app for WBS generation, project planning, budgeting, and schedule management. Tech: Vite 5.x, Vanilla JS (ES Modules), Chart.js, PDF.js, html2pdf.js, OpenAI API. Node 18+. GitHub: https://github.com/mjamiv/IPC-Builder | Live: https://mjamiv.github.io/IPC-Builder/

## Quick Start

```bash
npm install && npm run dev   # http://localhost:3000
npm run build               # Production
npm run lint && npm run format
```

Test commands (configured, not yet implemented): `npm run test`, `npm run test:e2e`.

## Project Structure (summary)

Entry: `index.html` → `<script type="module" src="/src/main.js">`. Core logic in `src/legacy/app-legacy.js` (~12k lines). Styles: `src/styles/main.css` (base → layout → components → features → layout/responsive). Data: `public/data/benchmarking/`, `docs/`, `.github/workflows/`. See repo tree for full layout.

## Domain agents (use these to reduce context)

- **ESDC** (revenue-based discipline, benchmarks, 64.5 rate, CHPE list): **@esdc-agent** or `.cursor/rules/esdc-agent.mdc`
- **Escalation** (cost escalation modal, March 1 rule, bell curve): **@escalation-agent** or `.cursor/rules/escalation-agent.mdc`
- **Costs** (KIE, burden, G&A, margin, assumed cost, cost summary table): **@costs-agent** or `.cursor/rules/costs-agent.mdc`

## Architecture (critical)

### ES Modules + Legacy

App uses ES modules; most logic lives in `src/legacy/app-legacy.js`, which exports 100+ functions to `window.*` for HTML `onclick` handlers.

**When adding functions called from HTML onclick:** You MUST add them to the global exports at the end of `app-legacy.js`:

```javascript
window.myNewFunction = myNewFunction;
```

**Early loading:** Critical functions (`discardRecovery`, `restoreRecovery`, `nextStep`, `prevStep`, `toggleDisc`) are exposed as placeholders at the top of app-legacy.js (lines 11–16) to avoid "function not yet loaded" errors.

### Entry flow

`index.html` → main.js → imports CSS, Chart/pdfjs/html2pdf, configures PDF.js worker (jsDelivr v3.11.174), exposes libs on window, imports state/constants/utils/services, creates `window.WBS`, imports app-legacy.js → attaches functions to window.

**window.WBS:** `{ state: { projectData, currentStep }, constants, utils, services: { storage, openai, csv, url } }`. New code should use WBS namespace; legacy is gradually migrated.

### CSS

Modular SMACSS/BEM: base → layout → components → features → layout/responsive (responsive.css last).

## Data model (summary)

Central structure: `projectData` in `src/legacy/app-legacy.js` (lines 19–85). Contains: `phases`, `disciplines`, `packages`, `budgets`, `claiming`, `dates`, `disciplineIds`, `packageIds`, `activities`, `reviewSteps`, `rfpReviewSteps`, `calculator` (totalConstructionCost, designFeePercent, etc.), `projectScope`, `scheduleNotes`, `disciplineScopes`, `projectInfo`, `commercialTerms`, `projectOrganization`. Stored in localStorage under `'wbs_project_autosave'`.

## Key features (summary)

6-step wizard: Phases → Disciplines → Packages → Budget (cost estimator, benchmarks) → Claiming → Schedule. AI: Chat, schedule generation, insights, RFP wizard (PDF import). Export: Design Fee Book PDF, CSV import, shareable URL. See app-legacy.js for implementation.

## Key functions (by area)

Navigation: `goToStep`, `nextStep`, `prevStep`, `showStep`. Persistence: `saveToLocalStorage`, `loadFromLocalStorage`, `showRecoveryModal`. Cost: `initCalculator`, `calculateBudgets`, `updateIndustryIndicators`, `calculateAssumedConstructionCost`, `updateMarginPercent`. MH/Benchmarks: `loadBenchmarkData`, `estimateMH`, `applyMHEstimate`. AI: `toggleChat`, `sendMessage`, `generateAISchedule`, `openRfpWizard`. Export: `generateDesignFeeBook`, `shareProjectUrl`, `importData`. All in app-legacy.js; search by name.

## Development guidelines

1. **Styling** – `src/styles/` by feature (base/components/features/layout).
2. **Business logic** – `src/legacy/app-legacy.js`.
3. **New onclick handlers** – Export to `window.*` at end of app-legacy.js.
4. **New modular code** – Add to `src/core/`, `src/utils/`, or `src/services/`; expose via window.WBS.
5. **Modals** – Use `modal-base` class.
6. **New features** – Section comments `// ============================================`, persist to localStorage.

**Path aliases (vite.config.js):** `@/` → src/, `@styles/`, `@components/`, `@utils/`, `@services/`, `@core/`.

**Conventions:** 4 spaces; kebab-case CSS, camelCase JS, UPPERCASE constants; ESLint/Prettier (legacy excluded from strict lint).

## Testing checklist

Wizard steps, budget totals, claiming 100%, dates, WBS table, charts, CSV/PDF export, responsive (768/480), auto-save, recovery modal, AI with API key.

## Design system

Dark terminal theme. Colors: `--bg-body` #0a0a0a, `--bg-terminal` #0d0d0d, `--color-primary` #ffd700, `--color-success` #00ff00, `--color-error` #ff4444. Font: JetBrains Mono. See `src/styles/base/variables.css`.

## Benchmarking & build

Benchmark JSONs in `public/data/benchmarking/` (14 files; discipline-specific metrics). Structure: discipline, eqty_metric, projects array. CI: `.github/workflows/ci.yml` (lint, build), `deploy.yml` (deploy to GH Pages). **Base path:** In `vite.config.js`, production `base` must match deployment (e.g. `/vinitaschangestomikesorig/` for GH Pages). Change it when deploying to a different URL.

## Known limitations

Client-side only; single-user; API key in localStorage; no undo/redo; legacy monolith in app-legacy.js.

## Troubleshooting

- **Function not loaded** – Expose early (app-legacy.js 11–16) and at bottom (window.*).
- **PDF.js** – Worker CDN in main.js; offline fails.
- **Build/404** – Check `base` in vite.config.js.
- **CSS/HMR** – Order: responsive.css last; main.css import order.
- **localStorage** – Client-only; use Save Project / recovery modal.

## Future

Modularize app-legacy; TypeScript; Vitest/Playwright tests; server persistence; collaboration; undo/redo. See docs/ for more.
