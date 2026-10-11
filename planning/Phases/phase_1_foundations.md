# Phase 1: Foundations (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [Phase 2 →](phase_2_economy_governance.md)

**Phase goal:** a playable skeleton. The project tooling works, the deterministic simulation engine ticks, the "Apex" UI shell exists, and the game saves and loads.
**Milestone:** **M1: Playable Skeleton**

---

## Sprint 1.1: Project Scaffold & Tooling (8 SP)

**Goal:** an empty but production-grade repo that every later sprint builds on.

| ID     | Story                                                                                    | SP  |
| ------ | ---------------------------------------------------------------------------------------- | --- |
| S1.1-1 | As a developer, I can run `npm run dev` and see the app shell in Chrome                  | 2   |
| S1.1-2 | As a developer, lint, typecheck, unit tests and e2e tests run locally and in CI          | 3   |
| S1.1-3 | As a developer, I know Electron packaging works (risk spike)                             | 2   |
| S1.1-4 | As a developer, I have an architecture guard that stops `src/sim` from importing UI code | 1   |

**Tasks**

- [x] Vite + React + TypeScript (strict) scaffold; folder layout as per master plan §4
- [x] ESLint (typescript-eslint, react-hooks, react-refresh), Prettier, `tsc --noEmit`
- [x] Vitest with coverage; Playwright with a Chrome-only project and one smoke test
- [x] ESLint `no-restricted-imports` rule: `src/sim/**` cannot import `react`, `src/ui`, `src/store` or DOM APIs
- [x] GitHub Actions `ci.yml`: install → lint → typecheck → unit → e2e → build
- [x] Throwaway Electron spike that builds a Windows `.exe` of the blank app (document findings, do not merge to main)
- [x] `README.md`, `AGENTS.md` (project rules), `.gitignore`, `.editorconfig`

**Acceptance criteria**

- A fresh clone followed by `npm ci && npm run verify` passes.
- CI is green on the PR.
- The spike notes are recorded in this file.

---

## Sprint 1.2: Simulation Core & Game Clock (8 SP)

**Goal:** a deterministic engine that advances time and runs systems in a fixed order.

| ID     | Story                                                                        | SP  |
| ------ | ---------------------------------------------------------------------------- | --- |
| S1.2-1 | As the engine, I hold an immutable `GameState` with versioned schema         | 2   |
| S1.2-2 | As the engine, I tick day by day with daily, monthly and yearly hooks        | 2   |
| S1.2-3 | As the engine, I use a seeded RNG so the same seed gives the same game       | 1   |
| S1.2-4 | As a system author, I can apply modifiers `{source, target, value, expires}` | 2   |
| S1.2-5 | As a player, I can pause and switch speed (1×, 2×, 4×)                       | 1   |

**Tasks**

- [x] `GameState` v1 types: `meta`, `clock`, `nation` (placeholder treasury, approval), `modifiers`, `log`
- [x] `createInitialState(seed, options)`
- [x] `engine.tick(state)` → new state; `SystemRunner` with ordered systems and cadence (daily, monthly, yearly)
- [x] `rng` (sfc32), with its state stored inside `GameState` so saves resume deterministically
- [x] Modifier stack: add, expire, and `resolve(target)` → `{ total, breakdown[] }` (this powers the future "Why?" tooltips)
- [x] Command pattern: `dispatch(state, command)` → validated new state
- [x] Determinism test: seed 42, 5 years of ticks, then compare the state hash snapshot

**Acceptance criteria**

- Running 1,825 ticks (5 years) headless takes < 1 s.
- The determinism test passes in CI.
- `src/sim` has ≥ 85% coverage.

---

## Sprint 1.3: Apex UI Shell, Save/Load & New Game (8 SP)

**Goal:** a player can start a game, watch time pass, and save and load it.

| ID     | Story                                                                                           | SP  |
| ------ | ----------------------------------------------------------------------------------------------- | --- |
| S1.3-1 | As a player, I see the main menu: New Game, Continue, Load, Settings, Quit                      | 1   |
| S1.3-2 | As a player, I see the top bar (date, speed controls, treasury, approval) and the left nav rail | 2   |
| S1.3-3 | As a designer, I have design tokens and primitives (Panel, Stat, Gauge, Button, Modal, Tooltip) | 2   |
| S1.3-4 | As a player, I can save to 5 slots, autosave monthly, and load                                  | 2   |
| S1.3-5 | As a player, I can choose the difficulty (Easy, Normal, Hard) on New Game                       | 1   |

**Tasks**

- [x] Theme tokens: dark (default) and light; saffron and green accents on navy and charcoal; Inter / Noto Sans
- [x] Zustand store bridge: game loop via `requestAnimationFrame` plus speed, then `tick` and render
- [x] Storage adapter interface, with the `localStorage` implementation first
- [x] Save format: `{ schemaVersion, savedAt, checksum, state }`; migration registry (empty for v1)
- [x] Responsive check: nav rail becomes bottom tabs at ≤ 768 px
- [x] Playwright e2e: new game → run 30 days → save → reload page → load → date matches

**Acceptance criteria / Demo (M1)**

- Start a new game, run 3 months, save, refresh the browser, load, and resume at the same date and treasury.
- Golden save fixture `v1.json` is committed and loads in a test.

---

## Phase 1 exit checklist

- [x] M1 demo recorded: screenshots in [`docs/screenshots/phase-1/`](../../docs/screenshots/phase-1/), and the flow is automated in `e2e/saveLoad.spec.ts`
- [x] All three sprint DoDs signed off (see the delivery notes below)
- [x] Known issues moved to the Phase 2 backlog (see below)

---

## Delivery notes (2026-10-11)

### Definition of Done evidence

| DoD item                                     | Result                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `lint`, `typecheck`, `test` exit 0           | ✅ `npm run verify` green locally                                                                  |
| New sim logic unit-tested; determinism green | ✅ 82 unit tests; 5-year golden hash snapshot; save-resume determinism test                        |
| UI works at 1920×1080 and 768 px             | ✅ `chrome-desktop` and `chrome-narrow` Playwright projects (13 e2e tests); also checked at 390 px |
| Content JSON schema-valid                    | n/a in Phase 1 (no content packs yet); save files are validated with zod                           |
| Playtest note, known issues logged           | ✅ below                                                                                           |
| Coverage `src/sim` ≥ 85%                     | ✅ 100% lines, 100% functions, 96% branches                                                        |
| 5 years headless < 1 s                       | ✅ asserted in `tests/sim/determinism.test.ts` (runs in well under 100 ms)                         |

### Electron spike findings (S1.1-3, throwaway, not merged)

- Electron 44 + electron-builder packaged `dist/` into `India Apex Sovereign.exe` (`--win dir`) with no code changes.
- A smoke run of the packaged exe loaded the game from `file://` and reported the correct title, rendered heading and loaded Inter font. `base: './'` in `vite.config.ts` is what makes `file://` loading work; keep it.
- `contextIsolation: true`, `nodeIntegration: false` worked with no changes to the renderer.
- Unpacked size is about 370 MB (normal for Electron; an NSIS installer compresses to roughly a quarter of that). Revisit Tauri only if download size becomes a complaint.
- No app icon yet (default Electron icon). Code signing is not set up; Windows SmartScreen will warn on unsigned builds. Both are Phase 6 work.

### Deviations from the plan

- **React 19** (latest stable) instead of React 18; Vite 8, Vitest 5, TypeScript 6, ESLint 10.
- The "Quit" menu item only appears when the platform shell supports quitting (Electron, Phase 6). The browser build has no quit.
- Speed buttons show 1×, 2×, 4× plus Pause; **Space** toggles pause (pulled forward from Sprint 6.2 because it was trivial).

### Playtest log

- New game → run at 4× for a year → annual report arrives in the inbox on 1 January, autosave writes monthly, save/reload/load resumes exactly.
- Fixed during playtest: the gauge percentage overlapped its caption; the phone-width tab bar clipped the last tabs.

### Known issues → Phase 2 backlog

- The fiscal and approval systems are placeholders with flat bases; Sprint 2.1 replaces them with the real economy model.
- The treasury can go negative with no borrowing; debt arrives in Sprint 2.1.
- The `Reports` view is a placeholder; history snapshots are already recorded for its charts.
- Autosave writes on every month close at high speed; consider throttling if storage moves to the filesystem (Phase 6).
